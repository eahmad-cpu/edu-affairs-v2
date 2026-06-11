import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/parent_student_summary.dart';

class GuardianChildrenService {
  GuardianChildrenService({
    FirebaseAuth? auth,
    FirebaseFirestore? firestore,
    this.orgId = 'takween',
  })  : _auth = auth ?? FirebaseAuth.instance,
        _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;
  final String orgId;

  Future<List<ParentStudentSummary>> loadMyChildren() async {
    final user = _auth.currentUser;

    if (user == null) {
      throw Exception('لم يتم تسجيل الدخول');
    }

    final userDoc = await _firestore.doc('users/${user.uid}').get();
    final userData = userDoc.data();

    final personId = _readString(userData, 'personId');

    if (personId.isEmpty) {
      throw Exception('حساب ولي الأمر غير مرتبط بسجل شخص');
    }

    final guardianId = await _findGuardianIdByPersonId(personId);

    if (guardianId.isEmpty) {
      return [];
    }

    final linksSnap = await _firestore
        .collection('orgs/$orgId/guardianLinks')
        .where('guardianId', isEqualTo: guardianId)
        .get();

    final activeLinks = linksSnap.docs.where((doc) {
      final data = doc.data();
      return data['active'] != false;
    }).toList();

    final children = <ParentStudentSummary>[];

    for (final linkDoc in activeLinks) {
      final linkData = linkDoc.data();
      final studentId = _readString(linkData, 'studentId');

      if (studentId.isEmpty) continue;

      final child = await _buildStudentSummary(
        studentId: studentId,
        relationType: _readString(linkData, 'relationType', fallback: 'OTHER'),
      );

      if (child != null) {
        children.add(child);
      }
    }

    children.sort((a, b) => a.studentName.compareTo(b.studentName));

    return children;
  }

  Future<String> _findGuardianIdByPersonId(String personId) async {
    final guardiansSnap = await _firestore
        .collection('orgs/$orgId/guardians')
        .where('personId', isEqualTo: personId)
        .limit(5)
        .get();

    for (final doc in guardiansSnap.docs) {
      final data = doc.data();
      final isArchived = data['isArchived'] == true;

      if (!isArchived) {
        return _readString(data, 'id', fallback: doc.id);
      }
    }

    return '';
  }

  Future<ParentStudentSummary?> _buildStudentSummary({
    required String studentId,
    required String relationType,
  }) async {
    final studentDoc =
        await _firestore.doc('orgs/$orgId/students/$studentId').get();

    final studentData = studentDoc.data();

    if (!studentDoc.exists || studentData == null) {
      return null;
    }

    if (studentData['isArchived'] == true) {
      return null;
    }

    final studentPersonId = _readString(studentData, 'personId');
    final studentName = await _loadPersonName(
      personId: studentPersonId,
      fallback: 'طالب بدون اسم',
    );

    final enrollment = await _loadActiveEnrollment(studentId);

    final schoolId = _readString(enrollment, 'schoolId');
    final academicYearId = _readString(enrollment, 'academicYearId');
    final gradeId = _readString(enrollment, 'gradeId');
    final classId = _readString(enrollment, 'classId');

    final schoolName = await _loadSchoolName(schoolId);
    final academicYearTitle = await _loadAcademicYearTitle(
      schoolId: schoolId,
      academicYearId: academicYearId,
    );
    final gradeTitle = await _loadGradeTitle(
      schoolId: schoolId,
      academicYearId: academicYearId,
      gradeId: gradeId,
    );
    final classTitle = await _loadClassTitle(
      schoolId: schoolId,
      academicYearId: academicYearId,
      classId: classId,
    );

    return ParentStudentSummary(
      orgId: orgId,
      studentId: studentId,
      studentName: studentName,
      relationType: relationType,
      schoolId: schoolId,
      schoolName: schoolName,
      academicYearId: academicYearId,
      academicYearTitle: academicYearTitle,
      gradeId: gradeId,
      gradeTitle: gradeTitle,
      classId: classId,
      classTitle: classTitle,
    );
  }

  Future<Map<String, dynamic>> _loadActiveEnrollment(String studentId) async {
    final snap = await _firestore
        .collection('orgs/$orgId/studentEnrollments')
        .where('studentId', isEqualTo: studentId)
        .get();

    for (final doc in snap.docs) {
      final data = doc.data();

      if (data['status'] == 'ACTIVE') {
        return data;
      }
    }

    return {};
  }

  Future<String> _loadPersonName({
    required String personId,
    required String fallback,
  }) async {
    if (personId.isEmpty) return fallback;

    final doc = await _firestore.doc('orgs/$orgId/people/$personId').get();
    final data = doc.data();

    return _readString(data, 'displayName', fallback: fallback);
  }

  Future<String> _loadSchoolName(String schoolId) async {
    if (schoolId.isEmpty) return '';

    final doc = await _firestore.doc('orgs/$orgId/schools/$schoolId').get();
    final data = doc.data();

    return _readString(data, 'name', fallback: schoolId);
  }

  Future<String> _loadAcademicYearTitle({
    required String schoolId,
    required String academicYearId,
  }) async {
    if (schoolId.isEmpty || academicYearId.isEmpty) return '';

    final doc = await _firestore
        .doc('orgs/$orgId/schools/$schoolId/academicYears/$academicYearId')
        .get();

    final data = doc.data();

    return _readString(data, 'title', fallback: academicYearId);
  }

  Future<String> _loadGradeTitle({
    required String schoolId,
    required String academicYearId,
    required String gradeId,
  }) async {
    if (schoolId.isEmpty || academicYearId.isEmpty || gradeId.isEmpty) {
      return '';
    }

    final doc = await _firestore
        .doc(
          'orgs/$orgId/schools/$schoolId/academicYears/$academicYearId/grades/$gradeId',
        )
        .get();

    final data = doc.data();

    return _readString(data, 'title', fallback: gradeId);
  }

  Future<String> _loadClassTitle({
    required String schoolId,
    required String academicYearId,
    required String classId,
  }) async {
    if (schoolId.isEmpty || academicYearId.isEmpty || classId.isEmpty) {
      return '';
    }

    final doc = await _firestore
        .doc(
          'orgs/$orgId/schools/$schoolId/academicYears/$academicYearId/classes/$classId',
        )
        .get();

    final data = doc.data();

    return _readString(data, 'title', fallback: classId);
  }

  String _readString(
    Map<String, dynamic>? data,
    String key, {
    String fallback = '',
  }) {
    final value = data?[key];

    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    return fallback;
  }
}