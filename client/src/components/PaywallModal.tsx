import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, Crown, Send, Star, Zap } from "lucide-react"

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredTier?: string;
  featureName?: string;
}

export function PaywallModal({ isOpen, onClose, requiredTier = "business", featureName = "этой функции" }: PaywallModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-background to-background p-6">
          <DialogHeader className="mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 text-primary mb-4 mx-auto">
              <Crown className="w-6 h-6" />
            </div>
            <DialogTitle className="text-2xl text-center font-bold">
              Обновите тариф
            </DialogTitle>
            <DialogDescription className="text-center text-base mt-2">
              Для доступа к <b>{featureName}</b> требуется тариф <b>{requiredTier.toUpperCase()}</b> или выше.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="border rounded-xl p-4 bg-background shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-slate-400" />
                <h3 className="font-semibold text-lg">STARTER</h3>
              </div>
              <div className="text-2xl font-bold mb-4">$11.99<span className="text-sm text-muted-foreground font-normal">/мес</span></div>
              <ul className="space-y-2 text-sm flex-1">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Веб-сайт магазина</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Админ-панель</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> Учет остатков</li>
              </ul>
            </div>

            <div className="border-2 border-primary rounded-xl p-4 bg-primary/5 shadow-md flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                РЕКОМЕНДУЕТСЯ
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg text-primary">BUSINESS</h3>
              </div>
              <div className="text-2xl font-bold mb-4">$17.99<span className="text-sm text-muted-foreground font-normal">/мес</span></div>
              <ul className="space-y-2 text-sm flex-1">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> <b>Всё из Starter</b></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> <b>Telegram Уведомления</b></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> <b>Расширенная аналитика</b></li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-primary" /> AI Ассистент</li>
              </ul>
            </div>
          </div>

          <div className="text-center">
            <Button className="w-full sm:w-auto text-lg px-8 py-6 rounded-full" onClick={() => window.open('https://t.me/your_telegram_username', '_blank')}>
              <Send className="w-5 h-5 mr-2" />
              Связаться для улучшения тарифа
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Или напишите нам напрямую: <b>@your_telegram_username</b>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
