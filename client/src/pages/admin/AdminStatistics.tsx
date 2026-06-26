import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useConfig } from '@/hooks/useConfig';
import {
  Users,
  ShoppingCart,
  Package,
  FolderOpen,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  UserCheck,
  AlertTriangle,
  History,
  Award,
  Zap,
  CreditCard,
  XCircle,
  UserPlus,
  BarChart2,
  Download,
  Minus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { PaywallModal } from '@/components/PaywallModal';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';

type Period = 'today' | 'week' | 'month' | 'year';

interface Comparison {
  revenue_pct: number | null;
  orders_pct: number | null;
  avg_order_pct: number | null;
  new_users_pct: number | null;
}

interface Statistics {
  period: string;
  total_users: number;
  new_users: number;
  users_with_orders: number;
  total_orders: number;
  total_revenue: number;
  avg_order_value: number;
  total_products: number;
  total_categories: number;
  comparison: Comparison;
  orders_by_status: Record<string, number>;
  payment_breakdown: Array<{ method: string; order_count: number; revenue: number }>;
  heatmap: Array<{ dow: number; hour: number; count: number }>;
  user_growth: Array<{ date: string; count: number }>;
  daily_sales: Array<{ date: string; order_count: number; revenue: number; avg_value: number }>;
  recent_orders: Array<{ date: string; count: number; revenue: number }>;
  top_products: Array<{ id: string; name: string; total_quantity: number; total_revenue: number }>;
  top_customers: Array<{ id: string; email: string; first_name: string; last_name: string; telegram_username: string; order_count: number; total_spent: number }>;
  category_revenue: Array<{ category_name: string; revenue: number }>;
  monthly_revenue: Array<{ month: string; revenue: number }>;
  cancelled_count: number;
  cancelled_revenue: number;
  cancellation_rate: number;
  inventory_summary: { total_stock: number; low_stock_count: number };
}

const PERIOD_LABELS: Record<Period, string> = { today: 'Сегодня', week: 'Неделя', month: 'Месяц', year: 'Год' };
const PAYMENT_METHOD_LABELS: Record<string, string> = { click: 'Click', payme: 'Payme', uzum: 'Uzum', card_transfer: 'Перевод' };
const PAYMENT_COLORS: Record<string, string> = { click: '#00AEEF', payme: '#00CDBE', uzum: '#7B68EE', card_transfer: '#10b981' };
const STATUS_LABELS: Record<string, string> = { pending: 'Ожидает', confirmed: 'Подтверждён', shipped: 'Отправлен', delivered: 'Доставлен', cancelled: 'Отменён' };
const STATUS_COLORS: Record<string, string> = { pending: 'bg-yellow-400', confirmed: 'bg-blue-500', shipped: 'bg-purple-500', delivered: 'bg-emerald-500', cancelled: 'bg-red-500' };
const DOW_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const PIE_COLORS = ['hsl(var(--primary))', '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function DeltaBadge({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) {
    return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" /> нет данных</span>;
  }
  const positive = pct >= 0;
  return (
    <span className={`text-xs font-bold flex items-center gap-0.5 ${positive ? 'text-emerald-500' : 'text-destructive'}`}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? '+' : ''}{pct}%
    </span>
  );
}

export default function AdminStatistics() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const { config } = useConfig();
  const subscriptionTier = config?.subscriptionTier || 'starter';
  const [paywallOpen, setPaywallOpen] = useState(false);
  const { toast } = useToast();

  const fetchStatistics = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/statistics?period=${p}`);
      const data = await response.json();
      setStats(data);
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить статистику', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchStatistics(period); }, [period, fetchStatistics]);

  const formatPrice = (price: number) => new Intl.NumberFormat('ru-RU').format(Math.round(price)) + ' сум';

  const conversionRate = useMemo(() => {
    if (!stats) return 0;
    return stats.total_users > 0 ? ((stats.users_with_orders / stats.total_users) * 100).toFixed(1) : 0;
  }, [stats]);

  const heatmapGrid = useMemo(() => {
    if (!stats) return [];
    const map: Record<string, number> = {};
    stats.heatmap.forEach(({ dow, hour, count }) => { map[`${dow}-${hour}`] = count; });
    const maxVal = Math.max(...stats.heatmap.map(h => h.count), 1);
    return Array.from({ length: 7 }, (_, dow) =>
      Array.from({ length: 24 }, (_, hour) => ({
        dow, hour,
        count: map[`${dow}-${hour}`] || 0,
        intensity: (map[`${dow}-${hour}`] || 0) / maxVal,
      }))
    );
  }, [stats]);

  const exportToExcel = () => {
    if (!stats) return;
    const ws = XLSX.utils.json_to_sheet(stats.daily_sales.map(row => ({
      'Дата': row.date,
      'Заказов': row.order_count,
      'Выручка (сум)': row.revenue,
      'Средний чек (сум)': row.avg_value,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Продажи');
    XLSX.writeFile(wb, `sales_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );

  if (!stats) return (
    <div className="text-center py-12 bg-card rounded-[32px] border-2 border-dashed border-border/50">
      <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
      <h3 className="text-xl font-bold">Не удалось загрузить статистику</h3>
    </div>
  );

  return (
    <div className="space-y-8 pb-10 relative">
      <PaywallModal isOpen={paywallOpen} onClose={() => setPaywallOpen(false)} featureName="Расширенной аналитики" />
      {subscriptionTier === 'starter' && (
        <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[4px] flex items-center justify-center rounded-xl">
          <Button size="lg" className="shadow-xl" onClick={() => setPaywallOpen(true)}>Разблокировать аналитику</Button>
        </div>
      )}

      <div className={`space-y-8 ${subscriptionTier === 'starter' ? 'opacity-40 pointer-events-none' : ''}`}>

        {/* Period Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground font-medium mr-1">Период:</span>
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${period === p ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-sm h-full overflow-hidden relative">
              <div className="absolute -right-4 -bottom-4 opacity-5"><DollarSign className="h-32 w-32" /></div>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Выручка</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-primary">{formatPrice(stats.total_revenue)}</div>
                <div className="flex items-center gap-2 mt-1">
                  <DeltaBadge pct={stats.comparison?.revenue_pct} />
                  <span className="text-xs text-muted-foreground">к прошл. {PERIOD_LABELS[period].toLowerCase()}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-none shadow-sm h-full overflow-hidden relative">
              <div className="absolute -right-4 -bottom-4 opacity-5"><ShoppingCart className="h-32 w-32" /></div>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Заказов</CardTitle>
                <ShoppingCart className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-blue-600">{stats.total_orders}</div>
                <div className="flex items-center gap-2 mt-1">
                  <DeltaBadge pct={stats.comparison?.orders_pct} />
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" /> ср.чек: {formatPrice(stats.avg_order_value)}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-none shadow-sm h-full overflow-hidden relative">
              <div className="absolute -right-4 -bottom-4 opacity-5"><Users className="h-32 w-32" /></div>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Новых польз.</CardTitle>
                <UserPlus className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-purple-600">{stats.new_users}</div>
                <div className="flex items-center gap-2 mt-1">
                  <DeltaBadge pct={stats.comparison?.new_users_pct} />
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><UserCheck className="h-3 w-3" /> конв: {conversionRate}%</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="bg-gradient-to-br from-red-500/5 to-red-500/10 border-none shadow-sm h-full overflow-hidden relative">
              <div className="absolute -right-4 -bottom-4 opacity-5"><XCircle className="h-32 w-32" /></div>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Отмены</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-red-600">{stats.cancelled_count}</div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 text-red-400" />
                  <span>{stats.cancellation_rate}% от заказов</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Revenue Trend + Category Pie */}
        <div className="grid gap-6 lg:grid-cols-7">
          <Card className="lg:col-span-4 rounded-3xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Тренд выручки</CardTitle>
              <CardDescription>{period === 'year' || period === 'month' ? 'По месяцам (последние 6 мес.)' : 'По дням за период'}</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] pl-0">
              {(() => {
                const data = (period === 'year' || period === 'month')
                  ? stats.monthly_revenue
                  : stats.daily_sales.map(d => ({ month: d.date, revenue: d.revenue }));
                if (!data.length) return <div className="h-full flex items-center justify-center text-muted-foreground/40 italic text-sm">Нет данных</div>;
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }}
                        tickFormatter={(val: string) => {
                          if (val.length === 7) {
                            const [y, m] = val.split('-');
                            return new Date(+y, +m - 1).toLocaleDateString('ru-RU', { month: 'short' });
                          }
                          return new Date(val).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                        }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => [formatPrice(value), 'Выручка']} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 rounded-3xl border-border/50 shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FolderOpen className="h-5 w-5 text-blue-500" />По категориям</CardTitle>
              <CardDescription>Распределение выручки</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {stats.category_revenue.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.category_revenue} cx="50%" cy="45%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="revenue" nameKey="category_name">
                      {stats.category_revenue.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => [formatPrice(value), 'Выручка']} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-muted-foreground/40 italic text-sm">Нет данных</div>}
            </CardContent>
          </Card>
        </div>

        {/* Payment Breakdown + Avg Order Value */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-3xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-5 w-5 text-emerald-500" />Способы оплаты</CardTitle>
              <CardDescription>Выручка по методам</CardDescription>
            </CardHeader>
            <CardContent className="h-[220px]">
              {stats.payment_breakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.payment_breakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`} />
                    <YAxis type="category" dataKey="method" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v: string) => PAYMENT_METHOD_LABELS[v] || v} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any, _: any, props: any) => [formatPrice(value), `${PAYMENT_METHOD_LABELS[props.payload.method] || props.payload.method} (${props.payload.order_count} зак.)`]} />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                      {stats.payment_breakdown.map((entry) => <Cell key={entry.method} fill={PAYMENT_COLORS[entry.method] || '#8b5cf6'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-muted-foreground/40 italic text-sm">Нет данных</div>}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><BarChart2 className="h-5 w-5 text-amber-500" />Средний чек</CardTitle>
              <CardDescription>Динамика за период</CardDescription>
            </CardHeader>
            <CardContent className="h-[220px] pl-0">
              {stats.daily_sales.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.daily_sales} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(val: string) => new Date(val).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => [formatPrice(value), 'Средний чек']} />
                    <Line type="monotone" dataKey="avg_value" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-muted-foreground/40 italic text-sm">Нет данных</div>}
            </CardContent>
          </Card>
        </div>

        {/* User Growth + Heatmap */}
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2 rounded-3xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-5 w-5 text-purple-500" />Рост пользователей</CardTitle>
              <CardDescription>Новые регистрации по дням</CardDescription>
            </CardHeader>
            <CardContent className="h-[220px] pl-0">
              {stats.user_growth.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.user_growth} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(val: string) => new Date(val).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => [value, 'Новых польз.']} />
                    <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorUsers)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-muted-foreground/40 italic text-sm">Нет данных</div>}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 rounded-3xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><History className="h-5 w-5 text-orange-500" />Тепловая карта заказов</CardTitle>
              <CardDescription>По дням недели и часам суток</CardDescription>
            </CardHeader>
            <CardContent>
              {heatmapGrid.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[460px]">
                    <div className="flex mb-1 ml-7">
                      {[0, 4, 8, 12, 16, 20].map(h => (
                        <div key={h} className="text-[9px] text-muted-foreground" style={{ width: `${(4 / 24) * 100}%` }}>{h}:00</div>
                      ))}
                    </div>
                    {heatmapGrid.map((row, dow) => (
                      <div key={dow} className="flex items-center gap-1 mb-0.5">
                        <span className="text-[10px] text-muted-foreground w-6 text-right shrink-0">{DOW_LABELS[dow]}</span>
                        <div className="flex gap-[2px] flex-1">
                          {row.map(({ hour, count, intensity }) => (
                            <div key={hour} title={`${DOW_LABELS[dow]} ${hour}:00 — ${count} заказов`}
                              className="rounded-[2px] cursor-default transition-transform hover:scale-125"
                              style={{ flex: 1, height: 16, backgroundColor: count === 0 ? 'hsl(var(--muted))' : `hsl(var(--primary) / ${0.15 + intensity * 0.85})` }} />
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-3 ml-7">
                      <span className="text-[10px] text-muted-foreground">Мало</span>
                      {[0.15, 0.35, 0.55, 0.75, 1].map(v => (
                        <div key={v} className="w-5 h-3 rounded-[2px]" style={{ backgroundColor: `hsl(var(--primary) / ${v})` }} />
                      ))}
                      <span className="text-[10px] text-muted-foreground">Много</span>
                    </div>
                  </div>
                </div>
              ) : <div className="h-32 flex items-center justify-center text-muted-foreground/40 italic text-sm">Нет данных</div>}
            </CardContent>
          </Card>
        </div>

        {/* Top Products + Top Customers */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><Award className="h-5 w-5 text-amber-500" />Топ товары</CardTitle>
                  <CardDescription>По объёму выручки за период</CardDescription>
                </div>
                <Package className="h-8 w-8 text-muted-foreground/10" />
              </div>
            </CardHeader>
            <CardContent className="p-0 min-h-[100px]">
              {stats.top_products.length > 0 ? (
                <div className="divide-y">
                  {stats.top_products.map((p: any, idx: number) => (
                    <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-100 text-slate-500' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-muted text-muted-foreground'}`}>#{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.total_quantity} шт. продано</p>
                      </div>
                      <p className="font-black text-sm text-primary">{formatPrice(p.total_revenue)}</p>
                    </div>
                  ))}
                </div>
              ) : <div className="p-12 text-center text-muted-foreground/50 italic text-sm">Нет данных</div>}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2"><Award className="h-5 w-5 text-blue-500" />Топ клиенты</CardTitle>
                  <CardDescription>По сумме покупок за период</CardDescription>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/10" />
              </div>
            </CardHeader>
            <CardContent className="p-0 min-h-[100px]">
              {stats.top_customers.length > 0 ? (
                <div className="divide-y">
                  {stats.top_customers.map((c: any, idx: number) => (
                    <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-100 text-slate-500' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-muted text-muted-foreground'}`}>#{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{c.first_name} {c.last_name || ''}</p>
                        <p className="text-xs text-muted-foreground">@{c.telegram_username || 'no_tg'} · {c.order_count} заказов</p>
                      </div>
                      <p className="font-black text-sm text-blue-600">{formatPrice(c.total_spent)}</p>
                    </div>
                  ))}
                </div>
              ) : <div className="p-12 text-center text-muted-foreground/50 italic text-sm">Нет данных</div>}
            </CardContent>
          </Card>
        </div>

        {/* Status + Daily Sales Table */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-3xl border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2"><History className="h-4 w-4" />Статусы заказов</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.orders_by_status).map(([status, count]: [string, any]) => {
                  const total = Object.values(stats.orders_by_status).reduce((a: number, b: any) => a + b, 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={status} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>{STATUS_LABELS[status] || status}</span>
                        <span>{count} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full ${STATUS_COLORS[status] || 'bg-primary'}`} />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(stats.orders_by_status).length === 0 && <p className="text-sm text-muted-foreground/50 italic text-center py-4">Нет данных</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 rounded-3xl border-border/50 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4" />Ежедневные продажи</CardTitle>
                  <CardDescription>Таблица за выбранный период</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2 h-8 text-xs">
                  <Download className="h-3.5 w-3.5" />Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[280px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
                    <tr>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2">Дата</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Заказов</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Выручка</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2">Ср. чек</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {stats.daily_sales.length > 0 ? stats.daily_sales.slice().reverse().map(row => (
                      <tr key={row.date} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-xs">{new Date(row.date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-blue-600 font-semibold">{row.order_count}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-primary font-bold">{formatPrice(row.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-amber-600 font-medium">{formatPrice(row.avg_value)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground/40 italic text-xs">Нет данных за период</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
