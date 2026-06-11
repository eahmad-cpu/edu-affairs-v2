class StudentNotesSummary {
  const StudentNotesSummary({
    required this.items,
    required this.positiveCount,
    required this.academicCount,
    required this.followUpCount,
  });

  final List<StudentNoteItem> items;

  final int positiveCount;
  final int academicCount;
  final int followUpCount;

  int get totalCount => items.length;

  StudentNoteItem? get latestItem {
    if (items.isEmpty) return null;
    return items.first;
  }

  bool get isEmpty => items.isEmpty;
}

class StudentNoteItem {
  const StudentNoteItem({
    required this.id,
    required this.studentId,
    required this.title,
    required this.body,
    required this.noteType,
    required this.severity,
    required this.status,
    required this.visibility,
    required this.followUpStatus,
    required this.noteAtMs,
    required this.createdByRoleKey,
    required this.tags,
  });

  final String id;
  final String studentId;

  final String title;
  final String body;

  final String noteType;
  final String severity;
  final String status;
  final String visibility;
  final String followUpStatus;

  final int noteAtMs;

  final String createdByRoleKey;
  final List<String> tags;

  DateTime get noteAt => DateTime.fromMillisecondsSinceEpoch(noteAtMs);

  String get dateLabel {
    if (noteAtMs <= 0) return 'غير محدد';

    final d = noteAt;
    final day = d.day.toString().padLeft(2, '0');
    final month = d.month.toString().padLeft(2, '0');
    final year = d.year.toString();

    return '$day/$month/$year';
  }

  String get noteTypeLabel {
    switch (noteType) {
      case 'POSITIVE':
        return 'إيجابية';
      case 'ACADEMIC':
        return 'تعليمية';
      case 'BEHAVIOR':
        return 'سلوكية';
      case 'BEHAVIOR_POSITIVE':
        return 'سلوك إيجابي';
      case 'ATTENDANCE':
        return 'حضور';
      case 'INTERNAL':
        return 'داخلية';
      default:
        return noteType.isEmpty ? 'ملاحظة' : noteType;
    }
  }

  String get severityLabel {
    switch (severity) {
      case 'LOW':
        return 'خفيفة';
      case 'NORMAL':
        return 'عادية';
      case 'MEDIUM':
        return 'متوسطة';
      case 'HIGH':
        return 'عالية';
      case 'CRITICAL':
        return 'حرجة';
      default:
        return severity.isEmpty ? 'عادية' : severity;
    }
  }

  String get followUpLabel {
    switch (followUpStatus) {
      case 'NONE':
        return 'لا تحتاج متابعة';
      case 'NEEDED':
        return 'تحتاج متابعة';
      case 'IN_PROGRESS':
        return 'جاري المتابعة';
      case 'DONE':
        return 'تمت المتابعة';
      case 'CANCELLED':
        return 'ألغيت المتابعة';
      default:
        return followUpStatus.isEmpty ? 'لا تحتاج متابعة' : followUpStatus;
    }
  }

  bool get isPositive {
    return noteType == 'POSITIVE' || noteType == 'BEHAVIOR_POSITIVE';
  }

  bool get isAcademic {
    return noteType == 'ACADEMIC';
  }

  bool get needsFollowUp {
    return followUpStatus == 'NEEDED' || followUpStatus == 'IN_PROGRESS';
  }
}