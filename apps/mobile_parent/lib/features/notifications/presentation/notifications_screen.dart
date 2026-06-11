import 'package:flutter/material.dart';

import '../data/parent_notification.dart';
import '../data/parent_notifications_service.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final service = ParentNotificationsService();

    return Scaffold(
      appBar: AppBar(
        title: const Text('الإشعارات'),
      ),
      body: StreamBuilder<List<ParentNotification>>(
        stream: service.watchNotifications(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final notifications = snapshot.data ?? const [];

          if (notifications.isEmpty) {
            return const Center(
              child: Text('لا توجد إشعارات حتى الآن'),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: notifications.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final notification = notifications[index];

              return _NotificationCard(
                notification: notification,
                onMarkAsRead: () => service.markAsRead(notification.id),
              );
            },
          );
        },
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.notification,
    required this.onMarkAsRead,
  });

  final ParentNotification notification;
  final VoidCallback onMarkAsRead;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: notification.isRead ? null : onMarkAsRead,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                notification.isRead
                    ? Icons.notifications_none
                    : Icons.notifications_active,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: notification.isRead
                            ? FontWeight.w500
                            : FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(notification.body),
                    const SizedBox(height: 8),
                    Text(
                      _formatDate(notification.createdAt),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              if (!notification.isRead)
                const Padding(
                  padding: EdgeInsets.only(top: 4),
                  child: Icon(Icons.circle, size: 10),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(int timestampMs) {
    if (timestampMs <= 0) return '';

    final date = DateTime.fromMillisecondsSinceEpoch(timestampMs);

    return '${date.year}/${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')}';
  }
}