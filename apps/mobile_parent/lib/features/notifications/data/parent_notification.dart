class ParentNotification {
  const ParentNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.status,
    required this.type,
    required this.targetRoute,
    required this.targetParams,
    required this.createdAt,
    required this.readAt,
  });

  final String id;
  final String title;
  final String body;
  final String status;
  final String type;
  final String targetRoute;
  final Map<String, dynamic> targetParams;
  final int createdAt;
  final int? readAt;

  bool get isRead => status == 'READ';

  factory ParentNotification.fromMap(
    String id,
    Map<String, dynamic> data,
  ) {
    return ParentNotification(
      id: id,
      title: _readString(data, 'title', fallback: 'إشعار جديد'),
      body: _readString(data, 'body', fallback: ''),
      status: _readString(data, 'status', fallback: 'PENDING'),
      type: _readString(data, 'type'),
      targetRoute: _readString(data, 'targetRoute'),
      targetParams: _readMap(data, 'targetParams'),
      createdAt: _readInt(data, 'createdAt'),
      readAt: _readNullableInt(data, 'readAt'),
    );
  }

  static String _readString(
    Map<String, dynamic> data,
    String key, {
    String fallback = '',
  }) {
    final value = data[key];
    if (value is String && value.trim().isNotEmpty) return value.trim();
    return fallback;
  }

  static int _readInt(Map<String, dynamic> data, String key) {
    final value = data[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    return 0;
  }

  static int? _readNullableInt(Map<String, dynamic> data, String key) {
    final value = data[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    return null;
  }

  static Map<String, dynamic> _readMap(
    Map<String, dynamic> data,
    String key,
  ) {
    final value = data[key];
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return const {};
  }
}