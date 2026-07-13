import Link from 'next/link';
import { markAllNotificationsRead, markNotificationRead } from './actions';
import { getNotifications } from '@/lib/server/notifications';

export const dynamic = 'force-dynamic';

function formatDate(value: Date): string {
  return value.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function NotificationsPage() {
  const notifications = await getNotifications();
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Workspace alerts for opportunity changes, report readiness, and portfolio follow-up.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">
            {unreadCount} unread
          </div>
          {unreadCount > 0 ? (
            <form action={markAllNotificationsRead}>
              <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Mark all read</button>
            </form>
          ) : null}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="card mt-6 py-10 text-center">
          <h2 className="text-lg font-semibold">No notifications yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Seed the demo database or run future jobs to populate workspace alerts.
          </p>
          <Link className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white" href="/overview">
            Open dashboard
          </Link>
        </div>
      ) : (
        <div className="card mt-6">
          <div className="divide-y divide-white/10">
            {notifications.map((notification) => (
              <article className="py-4 first:pt-0 last:pb-0" key={notification.id}>
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      {!notification.readAt ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
                      <h2 className="font-semibold">{notification.title}</h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{notification.body}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm text-slate-500">{formatDate(notification.createdAt)}</div>
                    {!notification.readAt ? (
                      <form action={markNotificationRead}>
                        <input name="notificationId" type="hidden" value={notification.id} />
                        <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10">
                          Mark read
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">{notification.readAt ? `Read ${formatDate(notification.readAt)}` : 'Unread'}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
