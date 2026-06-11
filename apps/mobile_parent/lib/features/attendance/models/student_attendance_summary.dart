class StudentAttendanceSummary {
  const StudentAttendanceSummary({
    required this.items,
    required this.presentCount,
    required this.absentCount,
    required this.lateCount,
    required this.excusedCount,
    required this.leftEarlyCount,
  });

  final List<StudentAttendanceItem> items;

  final int presentCount;
  final int absentCount;
  final int lateCount;
  final int excusedCount;
  final int leftEarlyCount;

  int get totalCount => items.length;

  StudentAttendanceItem? get latestItem {
    if (items.isEmpty) return null;
    return items.first;
  }

  bool get isEmpty => items.isEmpty;
}

class StudentAttendanceItem {
  const StudentAttendanceItem({
    required this.id,
    required this.studentId,
    required this.schoolDayId,
    required this.status,
    required this.recordedAtMs,
    required this.lateMinutes,
    required this.leftEarlyMinutes,
    required this.excuseReason,
    required this.note,
  });

  final String id;
  final String studentId;
  final String schoolDayId;
  final String status;
  final int recordedAtMs;

  final int lateMinutes;
  final int leftEarlyMinutes;

  final String excuseReason;
  final String note;

  DateTime get recordedAt =>
      DateTime.fromMillisecondsSinceEpoch(recordedAtMs);

  String get statusLabel {
    switch (status) {
      case 'PRESENT':
        return 'حاضر';
      case 'ABSENT':
        return 'غائب';
      case 'LATE':
        return 'متأخر';
      case 'EXCUSED_ABSENT':
        return 'غياب بعذر';
      case 'EXCUSED_LATE':
        return 'تأخر بعذر';
      case 'LEFT_EARLY':
        return 'انصراف مبكر';
      case 'REMOTE_PRESENT':
        return 'حضور عن بُعد';
      case 'REMOTE_ABSENT':
        return 'غياب عن بُعد';
      case 'NOT_RECORDED':
        return 'لم يسجل';
      default:
        return status;
    }
  }

  String get dateLabel {
    final d = recordedAt;
    final day = d.day.toString().padLeft(2, '0');
    final month = d.month.toString().padLeft(2, '0');
    final year = d.year.toString();

    return '$day/$month/$year';
  }

  String get extraLine {
    final parts = <String>[];

    if (lateMinutes > 0) {
      parts.add('تأخر $lateMinutes دقيقة');
    }

    if (leftEarlyMinutes > 0) {
      parts.add('انصراف مبكر $leftEarlyMinutes دقيقة');
    }

    if (excuseReason.isNotEmpty) {
      parts.add(excuseReason);
    }

    if (note.isNotEmpty) {
      parts.add(note);
    }

    if (parts.isEmpty) return 'لا توجد ملاحظات';

    return parts.join(' • ');
  }
}