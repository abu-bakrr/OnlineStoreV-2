import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Ticket, Percent, Coins } from 'lucide-react';

interface PromoCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminPromoCodes() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '' as string | number,
    min_order_amount: '' as string | number,
    usage_limit: '' as string | number,
    is_active: true,
  });

  useEffect(() => {
    fetchPromos();
  }, []);

  const fetchPromos = async () => {
    try {
      const response = await fetch('/api/admin/promo-codes');
      const data = await response.json();
      setPromos(data);
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить промокоды', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingPromo(null);
    setFormData({
      code: '',
      discount_type: 'percentage',
      discount_value: '',
      min_order_amount: '',
      usage_limit: '',
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (promo: PromoCode) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      min_order_amount: promo.min_order_amount,
      usage_limit: promo.usage_limit ?? '',
      is_active: promo.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      ...formData,
      discount_value: formData.discount_value === '' ? 0 : Number(formData.discount_value),
      min_order_amount: formData.min_order_amount === '' ? 0 : Number(formData.min_order_amount),
      usage_limit: formData.usage_limit === '' ? null : Number(formData.usage_limit)
    };

    try {
      const url = editingPromo 
        ? `/api/admin/promo-codes/${editingPromo.id}`
        : '/api/admin/promo-codes';
      
      const response = await fetch(url, {
        method: editingPromo ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save promo code');

      toast({
        title: 'Успешно',
        description: editingPromo ? 'Промокод обновлен' : 'Промокод добавлен',
      });

      setIsDialogOpen(false);
      fetchPromos();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить промокод', variant: 'destructive' });
    }
  };

  const handleDelete = async (promoId: string) => {
    if (!confirm('Удалить этот промокод?')) return;

    try {
      await fetch(`/api/admin/promo-codes/${promoId}`, { method: 'DELETE' });
      toast({ title: 'Успешно', description: 'Промокод удален' });
      fetchPromos();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось удалить промокод', variant: 'destructive' });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' сум';
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Всего промокодов: {promos.length}
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Создать промокод
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingPromo ? 'Редактировать промокод' : 'Создать новый промокод'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="code">Промокод (только латиница и цифры)</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER2024"
                  required
                  disabled={!!editingPromo}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Тип скидки</Label>
                  <Select 
                    value={formData.discount_type} 
                    onValueChange={(val: 'percentage' | 'fixed') => setFormData({ ...formData, discount_type: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Процент (%)</SelectItem>
                      <SelectItem value="fixed">Сумма (UZS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Значение скидки</Label>
                  <Input
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Минимальная сумма заказа (сум)</Label>
                <Input
                  type="number"
                  value={formData.min_order_amount}
                  onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Лимит использований (оставьте пустым для безлимита)</Label>
                <Input
                  type="number"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                  placeholder="Безлимитно"
                />
              </div>

              <div className="flex items-center justify-between p-2 border rounded-lg">
                <Label htmlFor="active-switch" className="flex items-center gap-2 cursor-pointer">
                  Статус: {formData.is_active ? 'Активен' : 'Отключен'}
                </Label>
                <Switch
                  id="active-switch"
                  checked={formData.is_active}
                  onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={!formData.code || formData.discount_value <= 0}>
                  {editingPromo ? 'Сохранить' : 'Создать'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {promos.map((promo) => (
          <Card key={promo.id} className={!promo.is_active ? 'opacity-60 bg-muted/50' : ''}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-2 py-1 rounded font-mono font-bold">
                  <Ticket className="h-4 w-4" />
                  {promo.code}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => openEditDialog(promo)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(promo.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Скидка:</span>
                  <span className="font-semibold flex items-center gap-1">
                    {promo.discount_type === 'percentage' ? (
                      <><Percent className="h-3 w-3" /> {promo.discount_value}%</>
                    ) : (
                      <><Coins className="h-3 w-3" /> {formatPrice(promo.discount_value)}</>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Мин. заказ:</span>
                  <span>{formatPrice(promo.min_order_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Использовано:</span>
                  <span>
                    {promo.used_count} / {promo.usage_limit || '∞'}
                  </span>
                </div>
                <div className="pt-2 flex items-center justify-between border-t mt-2">
                  <span className={promo.is_active ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                    {promo.is_active ? 'Активен' : 'Отключен'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {promos.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground">
          <Ticket className="h-12 w-12 mx-auto mb-4 opacity-20" />
          Промокоды не найдены. Создайте свой первый промокод!
        </div>
      )}
    </div>
  );
}
