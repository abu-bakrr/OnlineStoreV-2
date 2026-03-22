import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  X, 
  Upload, 
  Image as ImageIcon, 
  Palette, 
  Package, 
  Layers, 
  Tags,
  Filter,
  ArrowUpDown,
  MoreVertical,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Attribute {
  name: string;
  values: string[];
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category_id: string;
  colors: string[];
  attributes: Attribute[];
  old_price?: number;
}

interface Category {
  id: string;
  name: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    images: [] as string[],
    category_id: '',
    colors: [] as string[],
    attributes: [] as Attribute[],
    old_price: '',
  });

  const [newColor, setNewColor] = useState('#000000');
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [search, categoryFilter]);

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter);
      
      const response = await fetch(`/api/admin/products?${params}`);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить товары', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/admin/categories');
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalCategories = categories.length;
    const avgPrice = products.length > 0 
      ? products.reduce((sum: number, p: Product) => sum + (Number(p.price) || 0), 0) / products.length 
      : 0;
    return { totalProducts, totalCategories, avgPrice };
  }, [products, categories]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploadingImages(true);
    const newImages: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formDataUpload
        });

        if (response.ok) {
          const data = await response.json();
          newImages.push(data.secure_url);
        } else {
          const error = await response.json();
          toast({ title: 'Ошибка загрузки', description: error.error || 'Не удалось загрузить изображение', variant: 'destructive' });
        }
      } catch (error) {
        console.error('Upload error:', error);
        toast({ title: 'Ошибка', description: 'Не удалось загрузить изображение', variant: 'destructive' });
      }
    }

    setFormData((prev: typeof formData) => ({
      ...prev,
      images: [...prev.images, ...newImages]
    }));
    setUploadingImages(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev: typeof formData) => ({
      ...prev,
      images: prev.images.filter((_, i: number) => i !== index)
    }));
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      images: [],
      category_id: '',
      colors: [],
      attributes: [],
      old_price: '',
    });
    setNewColor('#000000');
    setNewAttrName('');
    setNewAttrValue('');
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      images: product.images || [],
      category_id: product.category_id || '',
      colors: product.colors || [],
      attributes: product.attributes || [],
      old_price: product.old_price?.toString() || '',
    });
    setNewColor('#000000');
    setNewAttrName('');
    setNewAttrValue('');
    setIsDialogOpen(true);
  };

  const addColor = () => {
    if (newColor && !formData.colors.includes(newColor)) {
      setFormData((prev: typeof formData) => ({
        ...prev,
        colors: [...prev.colors, newColor]
      }));
    }
  };

  const removeColor = (colorToRemove: string) => {
    setFormData((prev: typeof formData) => ({
      ...prev,
      colors: prev.colors.filter((c: string) => c !== colorToRemove)
    }));
  };

  const addAttribute = () => {
    if (newAttrName.trim()) {
      const existingAttr = formData.attributes.find((a: Attribute) => a.name === newAttrName.trim());
      if (!existingAttr) {
        setFormData((prev: typeof formData) => ({
          ...prev,
          attributes: [...prev.attributes, { name: newAttrName.trim(), values: [] }]
        }));
        setNewAttrName('');
      }
    }
  };

  const removeAttribute = (attrName: string) => {
    setFormData((prev: typeof formData) => ({
      ...prev,
      attributes: prev.attributes.filter((a: Attribute) => a.name !== attrName)
    }));
  };

  const addAttrValue = (attrName: string, value: string) => {
    if (value.trim()) {
      setFormData((prev: typeof formData) => ({
        ...prev,
        attributes: prev.attributes.map((attr: Attribute) => 
          attr.name === attrName && !attr.values.includes(value.trim())
            ? { ...attr, values: [...attr.values, value.trim()] }
            : attr
        )
      }));
    }
  };

  const removeAttrValue = (attrName: string, valueToRemove: string) => {
    setFormData((prev: typeof formData) => ({
      ...prev,
      attributes: prev.attributes.map((attr: Attribute) => 
        attr.name === attrName
          ? { ...attr, values: attr.values.filter((v: string) => v !== valueToRemove) }
          : attr
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseInt(formData.price),
        images: formData.images.length > 0 ? formData.images : ['https://via.placeholder.com/400x400?text=No+Image'],
        category_id: formData.category_id || null as any,
        colors: formData.colors,
        attributes: formData.attributes.filter((attr: Attribute) => attr.values.length > 0),
        old_price: formData.old_price ? parseInt(formData.old_price) : null,
      };

      const url = editingProduct 
        ? `/api/admin/products/${editingProduct.id}`
        : '/api/admin/products';
      
      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to save product');

      toast({
        title: 'Успешно',
        description: editingProduct ? 'Товар обновлен' : 'Товар добавлен',
      });

      setIsDialogOpen(false);
      fetchProducts();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить товар', variant: 'destructive' });
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Удалить этот товар?')) return;

    try {
      await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      toast({ title: 'Успешно', description: 'Товар удален' });
      fetchProducts();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось удалить товар', variant: 'destructive' });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' сум';
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Stats Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-none shadow-sm overflow-hidden relative">
          <div className="absolute -right-2 -bottom-2 opacity-10">
            <Package className="h-24 w-24" />
          </div>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Всего товаров</p>
                <h3 className="text-2xl font-bold">{stats.totalProducts}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-none shadow-sm overflow-hidden relative">
          <div className="absolute -right-2 -bottom-2 opacity-10">
            <Layers className="h-24 w-24" />
          </div>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Layers className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Категории</p>
                <h3 className="text-2xl font-bold">{stats.totalCategories}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-none shadow-sm overflow-hidden relative">
          <div className="absolute -right-2 -bottom-2 opacity-10">
            <Tags className="h-24 w-24" />
          </div>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Tags className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Средняя цена</p>
                <h3 className="text-2xl font-bold">{formatPrice(Math.round(stats.avgPrice))}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск товаров по названию..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-card border-border/50"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48 h-11 bg-card border-border/50">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Все категории" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} size="lg" className="shrink-0 h-11 px-6 shadow-md hover:shadow-lg transition-all">
              <Plus className="h-5 w-5 mr-2" />
              Создать товар
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl">{editingProduct ? 'Редактировать товар' : 'Новый товар'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Название</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="h-11"
                    placeholder="Напр. Смартфон Galaxy S24"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Описание</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="resize-none"
                    placeholder="Подробное описание товара..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Цена</Label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                      className="h-11"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Старая цена</Label>
                    <Input
                      type="number"
                      value={formData.old_price}
                      onChange={(e) => setFormData({ ...formData, old_price: e.target.value })}
                      className="h-11"
                      placeholder="Без скидки"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Категория</Label>
                    <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Фотографии</Label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {formData.images.map((img, idx) => (
                    <div key={idx} className="relative aspect-square group">
                      <img src={img} alt="" className="w-full h-full object-cover rounded-xl border" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImages}
                    className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:bg-muted/50 hover:border-primary/50 transition-all text-muted-foreground hover:text-primary"
                  >
                    {uploadingImages ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    ) : (
                      <>
                        <Upload className="h-6 w-6" />
                        <span className="text-[10px] font-medium">Загрузить</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
              </div>

              {/* Advanced Options (Colors & Attributes) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Palette className="h-4 w-4" /> Цвета
                  </Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.colors.map((color, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-muted rounded-full pl-1.5 pr-2 py-1 border shadow-sm">
                        <div 
                          className="w-4 h-4 rounded-full border border-black/10" 
                          style={{ backgroundColor: color }}
                        />
                        <button
                          type="button"
                          onClick={() => removeColor(color)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="w-10 h-10 rounded-lg border cursor-pointer p-1"
                    />
                    <Button type="button" variant="outline" onClick={addColor} size="icon" className="h-10 w-10">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Характеристики
                  </Label>
                  <div className="space-y-2">
                    {formData.attributes.map((attr, idx) => (
                      <div key={idx} className="bg-muted/50 rounded-xl p-2.5 space-y-2 border">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs uppercase tracking-tight">{attr.name}</span>
                          <button type="button" onClick={() => removeAttribute(attr.name)}>
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {attr.values.map((val, vIdx) => (
                            <span key={vIdx} className="bg-background text-[10px] font-medium px-2 py-0.5 rounded-full border">
                              {val}
                              <button type="button" onClick={() => removeAttrValue(attr.name, val)} className="ml-1 text-muted-foreground">×</button>
                            </span>
                          ))}
                        </div>
                        <Input
                          placeholder="Значение..."
                          className="h-8 text-xs bg-background"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addAttrValue(attr.name, (e.target as HTMLInputElement).value);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newAttrName}
                      onChange={(e) => setNewAttrName(e.target.value)}
                      placeholder="+ Атрибут"
                      className="h-10"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addAttribute();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addAttribute} size="icon" className="h-10 w-10">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="px-6 rounded-xl">
                  Отмена
                </Button>
                <Button type="submit" className="px-8 rounded-xl shadow-md">
                  {editingProduct ? 'Сохранить изменения' : 'Добавить товар'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Products Grid */}
      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.5) }}
            >
              <Card className="h-full overflow-hidden hover:shadow-xl transition-all border-border/50 group bg-card flex flex-col">
                <div className="aspect-[4/3] relative bg-muted overflow-hidden">
                  {product.images && product.images[0] ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                    {categories.find(c => c.id === product.category_id) && (
                      <Badge className="bg-white/90 backdrop-blur-sm text-black border-none hover:bg-white text-[10px] font-bold uppercase tracking-wider">
                        {categories.find(c => c.id === product.category_id)?.name}
                      </Badge>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-3 right-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="h-9 w-9 rounded-full shadow-lg"
                      onClick={() => openEditDialog(product)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-bold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <div className="font-mono text-[10px] text-muted-foreground opacity-50 shrink-0">
                      ID: {product.id.slice(0, 6)}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                    {product.description || 'Нет описания'}
                  </p>
                  
                  <div className="border-t pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-black tracking-tighter text-muted-foreground/40 leading-none mb-1">
                        Цена
                      </p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-xl font-black text-primary">
                          {formatPrice(product.price)}
                        </p>
                        {product.old_price && product.old_price > product.price && (
                          <p className="text-sm text-muted-foreground line-through decoration-destructive/30">
                            {formatPrice(product.old_price)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>

      {products.length === 0 && !loading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-24 bg-card rounded-[32px] border-2 border-dashed border-border/50"
        >
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="h-10 w-10 text-muted-foreground opacity-30" />
          </div>
          <h3 className="text-xl font-bold">Товары не найдены</h3>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">
            В этой категории пока нет товаров или они не соответствуют условиям поиска.
          </p>
          <Button 
            variant="link" 
            onClick={() => { setSearch(''); setCategoryFilter('all'); }}
            className="mt-4"
          >
            Сбросить фильтры
          </Button>
        </motion.div>
      )}
    </div>
  );
}
