import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Plus, 
  Minus, 
  Download, 
  Upload, 
  Pencil, 
  Trash2, 
  Package, 
  Image as ImageIcon, 
  Check, 
  Search, 
  AlertCircle,
  Save,
  ChevronDown,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  images?: string[];
  colors?: string[];
  attributes?: { name: string; values: string[] }[];
}

interface InventoryItem {
  id: string;
  product_id: string;
  product_name: string;
  color: string | null;
  attribute1_value: string | null;
  attribute2_value: string | null;
  quantity: number;
  backorder_lead_time_days: number | null;
}

export default function AdminInventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  const [formData, setFormData] = useState({
    product_id: "",
    color: "",
    attribute1_value: "",
    attribute2_value: "",
    quantity: 0,
  });

  const [quickAddQuantities, setQuickAddQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/admin/products"],
  });

  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/admin/inventory", selectedProductId],
    queryFn: async () => {
      const url = selectedProductId 
        ? `/api/admin/inventory?product_id=${selectedProductId}`
        : "/api/admin/inventory";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });

  const selectedProduct = products.find(p => p.id === formData.product_id);
  const filterProduct = products.find(p => p.id === selectedProductId);

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          color: data.color || null,
          attribute1_value: data.attribute1_value || null,
          attribute2_value: data.attribute2_value || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to add inventory");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Остаток добавлен" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось добавить остаток", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          quantity: data.quantity,
        }),
      });
      if (!res.ok) throw new Error("Failed to update inventory");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory"] });
      setEditingItem(null);
      toast({ title: "Остаток обновлён" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete inventory");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory"] });
      toast({ title: "Запись удалена" });
    },
  });

  const resetForm = () => {
    setFormData({
      product_id: "",
      color: "",
      attribute1_value: "",
      attribute2_value: "",
      quantity: 0,
    });
    setQuickAddQuantities({});
  };

  const handleExport = async () => {
    try {
      const res = await fetch("/api/admin/inventory/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inventory.csv";
      a.click();
      window.URL.revokeObjectURL(url);
      toast({ title: "Экспорт завершён" });
    } catch {
      toast({ title: "Ошибка экспорта", variant: "destructive" });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/inventory/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inventory"] });
      toast({ title: "Импорт завершён", description: `Импортировано: ${data.imported_count}` });
    } catch (err: any) {
      toast({ title: "Ошибка импорта", description: err.message, variant: "destructive" });
    }
    e.target.value = "";
  };

  const formatCombination = (item: InventoryItem | any) => {
    const parts = [];
    if (item.color) parts.push(item.color);
    if (item.attribute1_value || item.attr1) parts.push(item.attribute1_value || item.attr1);
    if (item.attribute2_value || item.attr2) parts.push(item.attribute2_value || item.attr2);
    return parts.length > 0 ? parts.join(" / ") : "Стандарт";
  };

  const getProductImage = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.images?.[0];
  };

  const getVariants = (product: Product) => {
    const variants: any[] = [];
    const colors = product.colors || [null];
    const attr1Values = product.attributes?.[0]?.values || [null];
    const attr2Values = product.attributes?.[1]?.values || [null];

    colors.forEach(color => {
      attr1Values.forEach(v1 => {
        attr2Values.forEach(v2 => {
          const key = `${color || ''}-${v1 || ''}-${v2 || ''}`;
          // Check if this variant already exists in inventory
          const existing = inventory.find(item => 
            item.product_id === product.id && 
            item.color === color && 
            item.attribute1_value === v1 && 
            item.attribute2_value === v2
          );

          variants.push({
            key,
            color,
            attr1: v1,
            attr2: v2,
            existingQuantity: existing?.quantity || 0,
            inventoryId: existing?.id
          });
        });
      });
    });

    return variants;
  };

  const handleQuickAdd = async () => {
    const promises = Object.entries(quickAddQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(async ([key, qty]) => {
        const variant = getVariants(selectedProduct!).find(v => v.key === key);
        if (variant.inventoryId) {
          return updateMutation.mutateAsync({ 
            id: variant.inventoryId, 
            data: { quantity: variant.existingQuantity + qty } 
          });
        } else {
          return addMutation.mutateAsync({
            product_id: selectedProduct!.id,
            color: variant.color || "",
            attribute1_value: variant.attr1 || "",
            attribute2_value: variant.attr2 || "",
            quantity: qty
          });
        }
      });

    try {
      await Promise.all(promises);
      toast({ title: "Все остатки обновлены" });
      setQuickAddQuantities({});
    } catch {
      toast({ title: "Ошибка при массовом обновлении", variant: "destructive" });
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.color && item.color.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.attribute1_value && item.attribute1_value.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const colorNameToHex = (colorName: string | null | undefined): string => {
    if (!colorName) return 'transparent';
    if (colorName.startsWith('#')) return colorName;
    const colors: Record<string, string> = {
      'красный': '#ef4444', 'red': '#ef4444',
      'синий': '#3b82f6', 'blue': '#3b82f6',
      'зеленый': '#22c55e', 'зелёный': '#22c55e', 'green': '#22c55e',
      'желтый': '#eab308', 'жёлтый': '#eab308', 'yellow': '#eab308',
      'оранжевый': '#f97316', 'orange': '#f97316',
      'фиолетовый': '#a855f7', 'purple': '#a855f7',
      'розовый': '#ec4899', 'pink': '#ec4899',
      'черный': '#1f2937', 'чёрный': '#1f2937', 'black': '#1f2937',
      'белый': '#ffffff', 'white': '#ffffff',
      'серый': '#6b7280', 'gray': '#6b7280', 'grey': '#6b7280',
      'коричневый': '#92400e', 'brown': '#92400e',
      'бежевый': '#d4b896', 'beige': '#d4b896',
      'голубой': '#38bdf8', 'light blue': '#38bdf8',
    };
    return colors[colorName.toLowerCase()] || '#6b7280';
  };

  const getStatusBadge = (quantity: number) => {
    if (quantity === 0) return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Нет на складе</Badge>;
    if (quantity < 5) return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Мало</Badge>;
    return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">В наличии</Badge>;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            Склад и Остатки
          </h1>
          <p className="text-muted-foreground mt-1">Управление запасами и вариациями товаров</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="h-10">
            <Upload className="h-4 w-4 mr-2" />
            Экспорт CSV
          </Button>
          <Label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild className="h-10">
              <span>
                <Download className="h-4 w-4 mr-2" />
                Импорт CSV
              </span>
            </Button>
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </Label>
        </div>
      </div>

      {/* Quick Add Section */}
      <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
        <div className="bg-primary/5 p-4 border-b border-primary/10 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-primary">
            <Plus className="h-5 w-5" />
            Быстрое пополнение
          </div>
          {selectedProduct && (
            <Button size="sm" variant="ghost" onClick={resetForm} className="h-8 text-xs underline">
              Сбросить выбор
            </Button>
          )}
        </div>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Выберите товар для пополнения</Label>
                <Select value={formData.product_id} onValueChange={(v) => { resetForm(); setFormData((f: typeof formData) => ({ ...f, product_id: v })); }}>
                  <SelectTrigger className="h-12 text-base border-2 focus:ring-primary/20">
                    <SelectValue placeholder="Поиск товара..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="py-3">
                        <div className="flex items-center gap-3">
                          {p.images?.[0] ? (
                            <img src={p.images[0]} alt="" className="w-8 h-8 object-cover rounded shadow-sm" />
                          ) : (
                            <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold leading-none">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground mt-1 uppercase">{p.id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedProduct && (
                <div className="h-12 flex items-center text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 border border-dashed italic">
                  Выберите товар, чтобы увидеть все доступные комбинации (цвет/размер)
                </div>
              )}
            </div>

            <AnimatePresence mode="wait">
              {selectedProduct ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="rounded-xl border bg-muted/30 overflow-hidden">
                    <div className="grid grid-cols-12 gap-4 p-3 bg-muted font-bold text-[10px] uppercase tracking-widest text-muted-foreground">
                      <div className="col-span-1"></div>
                      <div className="col-span-5">Вариант (Комбинация)</div>
                      <div className="col-span-3 text-center">На складе</div>
                      <div className="col-span-3 text-right pr-4">Добавить кол-во</div>
                    </div>
                    <div className="divide-y max-h-[400px] overflow-y-auto">
                      {getVariants(selectedProduct).map((v) => (
                        <div key={v.key} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white transition-colors">
                          <div className="col-span-1 flex justify-center">
                            {v.color && (
                              <div 
                                className="w-4 h-4 rounded-full border border-black/10 shadow-sm" 
                                style={{ backgroundColor: colorNameToHex(v.color) }}
                              />
                            )}
                          </div>
                          <div className="col-span-5 font-medium">{formatCombination(v)}</div>
                          <div className="col-span-3 text-center">
                            <span className={cn("inline-flex items-center px-2 py-1 rounded-md text-xs font-bold", 
                              v.existingQuantity === 0 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {v.existingQuantity} шт
                            </span>
                          </div>
                          <div className="col-span-3 flex justify-end">
                            <div className="relative w-32">
                              <Input 
                                type="number"
                                min="0"
                                placeholder="0"
                                className="h-10 text-right pr-8 border-2 focus:border-primary"
                                value={quickAddQuantities[v.key] || ""}
                                onChange={(e) => setQuickAddQuantities(prev => ({
                                  ...prev,
                                  [v.key]: parseInt(e.target.value) || 0
                                }))}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">+</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" onClick={resetForm}>Отмена</Button>
                    <Button 
                      onClick={handleQuickAdd} 
                      className="px-8 shadow-lg shadow-primary/20 h-11"
                      disabled={Object.values(quickAddQuantities).every(q => q === 0)}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Сохранить все изменения
                    </Button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Table Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          Весь ассортимент
          <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {filteredInventory.length} позиций
          </span>
        </h2>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Поиск по названию или цвету..." 
            className="pl-10 h-10 border-2 bg-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground font-medium">Загрузка данных склада...</p>
        </div>
      ) : filteredInventory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed text-center px-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-bold text-lg">Записей не найдено</h3>
          <p className="text-muted-foreground max-w-xs">Перепроверьте фильтр или добавьте первый товар на склад через форму выше.</p>
          {searchQuery && (
            <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2">
              Очистить поиск
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-2xl border shadow-sm bg-white">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[80px] pl-6">Фото</TableHead>
                  <TableHead className="min-w-[200px]">Товар</TableHead>
                  <TableHead>Комбинация</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-center w-[180px]">Количество</TableHead>
                  <TableHead className="text-right pr-6 w-[120px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory.map((item: any) => (
                  <TableRow key={item.id} className="group transition-colors h-20">
                    <TableCell className="pl-6">
                      {getProductImage(item.product_id) ? (
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border shadow-sm">
                          <img 
                            src={getProductImage(item.product_id)} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center border">
                          <ImageIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm leading-tight text-slate-900">{item.product_name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase mt-1">ID: {item.id.slice(0, 8)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.color && (
                          <div 
                            className="w-3 h-3 rounded-full border border-black/10" 
                            style={{ backgroundColor: item.color.startsWith('#') ? item.color : '#6b7280' }}
                          />
                        )}
                        <span className="text-xs font-medium text-slate-600">{formatCombination(item)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(item.quantity)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        {editingItem?.id === item.id ? (
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number"
                              className="w-20 h-9 text-center font-bold"
                              value={editingItem.quantity === 0 ? '' : editingItem.quantity}
                              onChange={(e: any) => setEditingItem({ ...editingItem, quantity: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                              autoFocus
                            />
                            <Button size="icon" className="h-9 w-9" onClick={() => updateMutation.mutate({ id: item.id, data: { quantity: editingItem.quantity } })}>
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 bg-slate-50 rounded-lg border p-1 px-2">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm text-muted-foreground hover:text-red-500"
                              onClick={() => item.quantity > 0 && updateMutation.mutate({ id: item.id, data: { quantity: item.quantity - 1 } })}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-black text-sm">{item.quantity}</span>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7 rounded-md hover:bg-white hover:shadow-sm text-muted-foreground hover:text-green-500"
                              onClick={() => updateMutation.mutate({ id: item.id, data: { quantity: item.quantity + 1 } })}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingItem(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-red-50" onClick={() => deleteMutation.mutate(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredInventory.map((item: any) => (
              <Card key={item.id} className="border-2 overflow-hidden hover:border-primary/20 transition-all">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {getProductImage(item.product_id) ? (
                      <img 
                        src={getProductImage(item.product_id)} 
                        alt="" 
                        className="w-20 h-20 object-cover rounded-xl shadow-sm"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center border">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      <div>
                        <h3 className="font-bold text-base leading-tight truncate">{item.product_name}</h3>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {item.color && (
                            <div 
                              className="w-3 h-3 rounded-full border border-black/10" 
                              style={{ backgroundColor: item.color.startsWith('#') ? item.color : '#6b7280' }}
                            />
                          )}
                          <span className="text-xs text-muted-foreground truncate font-medium">
                            {formatCombination(item)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        {getStatusBadge(item.quantity)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg border p-1 px-3">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => item.quantity > 0 && updateMutation.mutate({ id: item.id, data: { quantity: item.quantity - 1 } })}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-10 text-center font-black text-lg">{item.quantity}</span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8"
                        onClick={() => updateMutation.mutate({ id: item.id, data: { quantity: item.quantity + 1 } })}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" className="h-10 w-10 border-2" onClick={() => setEditingItem(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-10 w-10 border-2 text-destructive" onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
