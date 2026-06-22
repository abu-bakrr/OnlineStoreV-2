import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, Crown, Send, Star, Zap, Bot, Smartphone, ChartBar, CreditCard } from "lucide-react"

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredTier?: string;
  featureName?: string;
}

export function PaywallModal({ isOpen, onClose, requiredTier = "business", featureName = "этой функции" }: PaywallModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden bg-background">
        <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-4 mx-auto">
              <Crown className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl md:text-3xl text-center font-bold">
              Обновите тариф
            </DialogTitle>
            <DialogDescription className="text-center text-base mt-2 max-w-lg mx-auto">
              Для доступа к <b>{featureName}</b> требуется тариф <b>{requiredTier.toUpperCase()}</b> или выше. Выберите подходящий план для роста вашего бизнеса.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* STARTER */}
            <div className="border rounded-xl p-5 bg-background shadow-sm flex flex-col opacity-60 grayscale-[50%] hover:grayscale-0 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-slate-400" />
                <h3 className="font-semibold text-lg text-slate-600">STARTER</h3>
              </div>
              <div className="text-2xl font-bold mb-4">$11.99<span className="text-sm text-muted-foreground font-normal">/мес</span></div>
              
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 mb-4 text-xs text-center border border-dashed border-slate-300">
                <span className="opacity-50">👀 Ручной контроль заказов</span>
              </div>

              <ul className="space-y-3 text-sm flex-1">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-slate-400 mt-0.5" /> <span>Веб-сайт магазина</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-slate-400 mt-0.5" /> <span>Админ-панель</span></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-slate-400 mt-0.5" /> <span>Ручные оплаты (перевод)</span></li>
              </ul>
            </div>

            {/* BUSINESS */}
            <div className="border-2 border-primary rounded-xl p-5 bg-primary/5 shadow-md flex flex-col relative transform hover:-translate-y-1 transition-all">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Выбор 70% клиентов
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg text-primary">BUSINESS</h3>
              </div>
              <div className="text-3xl font-bold mb-4">$19.99<span className="text-sm text-muted-foreground font-normal">/мес</span></div>
              
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 mb-4 shadow-sm border border-primary/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                   <Send className="w-3 h-3" /> Пуш: Новый заказ на 250,000 UZS!
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400">
                   <ChartBar className="w-3 h-3" /> Графики выручки открыты
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-orange-500">
                   <CreditCard className="w-3 h-3" /> Оплаты Click/Payme
                </div>
              </div>

              <ul className="space-y-3 text-sm flex-1">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5" /> <b>Всё из Starter</b></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5" /> <b>Telegram Уведомления</b></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5" /> <b>Интеграция Click/Payme</b></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5" /> <b>Расширенная аналитика</b></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5" /> Без водяного знака</li>
              </ul>
            </div>

            {/* PRO */}
            <div className="border border-purple-500/50 rounded-xl p-5 bg-gradient-to-b from-purple-500/10 to-transparent shadow-sm flex flex-col relative hover:shadow-purple-500/20 transition-all">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-lg text-purple-600 dark:text-purple-400">PRO / VIP</h3>
              </div>
              <div className="text-3xl font-bold mb-4">$29.99<span className="text-sm text-muted-foreground font-normal">/мес</span></div>
              
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 mb-4 shadow-sm border border-purple-500/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400">
                   <Bot className="w-3 h-3" /> ИИ: "Да, этот размер в наличии!"
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-pink-600 dark:text-pink-400">
                   <Smartphone className="w-3 h-3" /> Магазин прямо внутри Telegram
                </div>
              </div>

              <ul className="space-y-3 text-sm flex-1">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-purple-500 mt-0.5" /> <b>Всё из Business</b></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-purple-500 mt-0.5" /> <b>Умный ИИ-Консультант 24/7</b></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-purple-500 mt-0.5" /> <b>Telegram Mini App</b></li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-purple-500 mt-0.5" /> Приоритетная поддержка</li>
              </ul>
            </div>
          </div>

          <div className="text-center mt-4">
            <Button className="w-full sm:w-auto text-lg px-10 py-6 rounded-full shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5" onClick={() => window.open('https://t.me/your_telegram_username', '_blank')}>
              <Send className="w-5 h-5 mr-2" />
              Написать владельцу для улучшения тарифа
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Ваш магазин будет обновлен моментально после оплаты. Без потери данных.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
