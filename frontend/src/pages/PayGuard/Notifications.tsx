import PageMeta from "../../components/common/PageMeta";
import PageBreadCrumb from "../../components/common/PageBreadCrumb";
import { useState, useEffect } from "react";
import { Bell, Info, CheckCircle, AlertTriangle, Trash2, Clock } from "lucide-react";
import { supabase, fetchNotifications } from "../../lib/supabaseClient";

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const items = await fetchNotifications(user.id);
      setNotifications(items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await supabase.from("notifications").delete().eq("id", id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-emerald-600" size={24} />;
      case 'error': return <AlertTriangle className="text-red-600" size={24} />;
      default: return <Info className="text-blue-600" size={24} />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 dark:bg-emerald-900/20';
      case 'error': return 'bg-red-50 dark:bg-red-900/20';
      default: return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };

  return (
    <>
      <PageMeta
        title="Notifications | PayGuard AI"
        description="System notifications and audit alerts"
      />
      <PageBreadCrumb pageTitle="Notifications" />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell size={24} />
            Recent Activity
          </h2>
          <button 
            onClick={markAllAsRead}
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 transition"
          >
            Mark all as read
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">
              <Clock className="mx-auto mb-4 animate-spin" size={32} />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Bell className="mx-auto mb-4 opacity-20" size={48} />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm mt-1">No new notifications to display.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`p-6 flex gap-4 items-start transition hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!n.is_read ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''}`}
                >
                  <div className={`p-3 rounded-full ${getBgColor(n.type)}`}>
                    {getIcon(n.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        {n.type || 'System'} Alert
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className={`text-gray-900 dark:text-white ${!n.is_read ? 'font-bold' : 'font-normal'}`}>
                      {n.message}
                    </p>
                  </div>

                  <button 
                    onClick={() => deleteNotification(n.id)}
                    className="text-gray-400 hover:text-red-500 transition p-2"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
