class ParentStudentSummary {
  
  const ParentStudentSummary({
    required this.orgId,
    required this.studentId,
    required this.studentName,
    required this.relationType,
    required this.schoolId,
    required this.schoolName,
    required this.academicYearId,
    required this.academicYearTitle,
    required this.gradeId,
    required this.gradeTitle,
    required this.classId,
    required this.classTitle,
  });

  final String orgId;
  final String studentId;
  final String studentName;
  final String relationType;

  final String schoolId;
  final String schoolName;

  final String academicYearId;
  final String academicYearTitle;

  final String gradeId;
  final String gradeTitle;

  final String classId;
  final String classTitle;

  String get relationLabel {
    switch (relationType) {
      case 'FATHER':
        return 'الأب';
      case 'MOTHER':
        return 'الأم';
      default:
        return 'ولي أمر';
    }
  }

  String get classLine {
    final parts = <String>[
      if (gradeTitle.isNotEmpty) gradeTitle,
      if (classTitle.isNotEmpty) classTitle,
    ];

    if (parts.isEmpty) return 'لم يتم تحديد الفصل بعد';

    return parts.join(' / ');
  }
}