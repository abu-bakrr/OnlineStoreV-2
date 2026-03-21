import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
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
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'recharts';

interface Statistics {
  total_users: number;
  users_with_orders: number;
  total_orders: number;
  total_revenue: number;
  orders_by_status: Record<string, number>;
  total_products: number;
  total_categories: number;
  recent_orders: Array<{ date: string; count: number; revenue: number }>;
  top_products: Array<{ id: string; name: string; total_quantity: number; total_revenue: number }>;
  top_customers: Array<{ id: string; email: string; first_name: string; last_name: string; telegram_username: string; order_count: number; total_spent: number }>;
  category_revenue: Array<{ category_name: string; revenue: number }>;
  monthly_revenue: Array<{ month: string; revenue: number }>;
  inventory_summary: {
    total_stock: number;
    low_stock_count: number;
  };
}

export default function AdminStatistics() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/admin/statistics');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить статистику', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' сум';
  };

  const conversionRate = useMemo(() => {
    if (!stats) return 0;
    return stats.total_users > 0 
      ? ((stats.users_with_orders / stats.total_users) * 100).toFixed(1)
      : 0;
  }, [stats]);

  const avgOrderValue = useMemo(() => {
    if (!stats || stats.total_orders === 0) return 0;
    return Math.round(stats.total_revenue / stats.total_orders);
  }, [stats]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 bg-card rounded-[32px] border-2 border-dashed border-border/50">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <h3 className="text-xl font-bold">Не удалось загрузить статистику</h3>
        <p className="text-muted-foreground text-sm mt-2">Пожалуйста, попробуйте обновить страницу позже.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Top Level Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-sm h-full overflow-hidden relative">
            <div className="absolute -right-4 -bottom-4 opacity-5">
              <DollarSign className="h-32 w-32" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Общая выручка</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-primary">{formatPrice(stats.total_revenue)}</div>
              <div className="flex items-center gap-1 mt-1 text-xs text-emerald-500 font-bold">
                <ArrowUpRight className="h-3 w-3" />
                <span>За все время</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-none shadow-sm h-full overflow-hidden relative">
            <div className="absolute -right-4 -bottom-4 opacity-5">
              <ShoppingCart className="h-32 w-32" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Всего заказов</CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-blue-600">{stats.total_orders}</div>
              <div className="flex items-center gap-1 mt-1 text-xs text-blue-500/70 font-medium">
                <Zap className="h-3 w-3" />
                <span>Средний чек: {formatPrice(avgOrderValue)}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 border-none shadow-sm h-full overflow-hidden relative">
            <div className="absolute -right-4 -bottom-4 opacity-5">
              <Users className="h-32 w-32" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Пользователи</CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-purple-600">{stats.total_users}</div>
              <div className="flex items-center gap-1 mt-1 text-xs text-purple-500/70 font-medium">
                <UserCheck className="h-3 w-3" />
                <span>Конверсия: {conversionRate}%</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-none shadow-sm h-full overflow-hidden relative">
            <div className="absolute -right-4 -bottom-4 opacity-5">
              <Package className="h-32 w-32" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Склад</CardTitle>
              <Package className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-600">{stats.inventory_summary.total_stock}</div>
              <div className="flex items-center gap-1 mt-1 text-xs text-destructive font-bold">
                <AlertTriangle className="h-3 w-3" />
                <span>{stats.inventory_summary.low_stock_count} товаров мало</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4 rounded-3xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Тренд выручки
            </CardTitle>
            <CardDescription>Динамика за последние 6 месяцев (сум)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pl-0">
            {stats.monthly_revenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.monthly_revenue} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val: string) => {
                      const [year, month] = val.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1);
                      return date.toLocaleDateString('ru-RU', { month: 'short' });
                    }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val: number) => `${val / 1000000}M`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [formatPrice(value), 'Выручка']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 italic text-sm">
                <TrendingUp className="h-8 w-8 mb-2 opacity-20" />
                <span>Данных о продажах пока нет</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 rounded-3xl border-border/50 shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-blue-500" />
              По категориям
            </CardTitle>
            <CardDescription>Распределение выручки (сум)</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats.category_revenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.category_revenue}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="revenue"
                    nameKey="category_name"
                  >
                    {stats.category_revenue.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={`hsl(var(--primary), ${1 - index * 0.2})`} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [formatPrice(value), 'Выручка']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 italic text-sm">
                <FolderOpen className="h-8 w-8 mb-2 opacity-20" />
                <span>Нет данных по категориям</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  Топ товары
                </CardTitle>
                <CardDescription>По объему выручки</CardDescription>
              </div>
              <Package className="h-8 w-8 text-muted-foreground/10" />
            </div>
          </CardHeader>
          <CardContent className="p-0 min-h-[100px]">
            {stats.top_products.length > 0 ? (
              <div className="divide-y">
                {stats.top_products.map((p: any, idx: number) => (
                  <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.total_quantity} шт. продано</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm text-primary">{formatPrice(p.total_revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground/50 italic text-sm">
                Проданных товаров пока нет
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="h-5 w-5 text-blue-500" />
                  Топ клиенты
                </CardTitle>
                <CardDescription>По сумме покупок</CardDescription>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/10" />
            </div>
          </CardHeader>
          <CardContent className="p-0 min-h-[100px]">
            {stats.top_customers.length > 0 ? (
              <div className="divide-y">
                {stats.top_customers.map((c: any, idx: number) => (
                  <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-muted-foreground">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">
                        {c.first_name} {c.last_name || ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{c.telegram_username || 'no_tg'} • {c.order_count} заказов
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm text-blue-600">{formatPrice(c.total_spent)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground/50 italic text-sm">
                Активных покупателей пока нет
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status & History Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-3xl border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <History className="h-4 w-4" /> Статусы заказов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(stats.orders_by_status).map(([status, count]: [string, any]) => {
                const percentage = (count / stats.total_orders) * 100;
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="capitalize">{status}</span>
                      <span>{count} ({Math.round(percentage)}%)</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${percentage}%` }}
                        className="h-full bg-primary" 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-3xl border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Последние 7 дней</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px]">
            {stats.recent_orders.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.recent_orders}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val: string) => new Date(val).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [formatPrice(value), 'Выручка']}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 italic text-sm">
                <span>Нет данных за последние 7 дней</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
