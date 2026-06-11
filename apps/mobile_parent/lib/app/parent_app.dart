import 'package:flutter/material.dart';

import 'app_router.dart';
import 'app_theme.dart';

import '../services/foreground_notification_service.dart';

class ParentApp extends StatelessWidget {
  const ParentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: ForegroundNotificationService.scaffoldMessengerKey,
      title: 'تطبيق ولي الأمر',
      theme: buildAppTheme(),
      routerConfig: appRouter,
      locale: const Locale('ar'),
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}