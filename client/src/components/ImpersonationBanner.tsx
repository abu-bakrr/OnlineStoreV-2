import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ImpersonationBanner() {
  const { user, checkAuth } = useAuth();
  const { toast } = useToast();

  if (!user?.is_impersonating) return null;

  const handleStopImpersonating = async () => {
    try {
      const response = await fetch('/api/auth/stop-impersonating', {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to stop impersonating');

      toast({
        title: 'Успех',
        description: 'Вы вернулись в режим администратора',
      });

      // Refresh auth state and redirect to admin
      await checkAuth();
      window.location.href = '/admin';
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось вернуться в режим администратора',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="bg-amber-500 text-white py-2 px-4 flex items-center justify-between sticky top-0 z-[100] shadow-md">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ShieldAlert className="h-4 w-4" />
        <span>
          Вы вошли как <strong>{user.email || user.username || user.first_name || 'пользователь'}</strong> (Режим помощи)
        </span>
      </div>
      <Button 
        variant="secondary" 
        size="sm" 
        className="h-8 text-xs bg-white text-amber-600 hover:bg-amber-50"
        onClick={handleStopImpersonating}
      >
        <LogOut className="h-3 w-3 mr-1" />
        Вернуться в админку
      </Button>
    </div>
  );
}
