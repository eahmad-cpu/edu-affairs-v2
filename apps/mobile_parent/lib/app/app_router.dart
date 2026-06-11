import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';

import '../core/router/go_router_refresh_stream.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/splash_screen.dart';
import '../features/guardian/presentation/my_children_screen.dart';
import '../features/students/presentation/student_overview_screen.dart';
import '../features/notifications/presentation/notifications_screen.dart';


final appRouter = GoRouter(
  initialLocation: '/splash',
  refreshListenable: GoRouterRefreshStream(
    FirebaseAuth.instance.authStateChanges(),
  ),
  routes: [
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/children',
      builder: (context, state) => const MyChildrenScreen(),
    ),
    GoRoute(
      path: '/students/:studentId',
      builder: (context, state) {
        final studentId = state.pathParameters['studentId'] ?? '';

        return StudentOverviewScreen(studentId: studentId);
      },
    ),
    GoRoute(
      path: '/notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
  ],
  redirect: (context, state) {
    final user = FirebaseAuth.instance.currentUser;
    final location = state.matchedLocation;

    if (location == '/splash') {
      return null;
    }

    if (user == null && location != '/login') {
      return '/login';
    }

    if (user != null && location == '/login') {
      return '/children';
    }

    return null;
  },
);