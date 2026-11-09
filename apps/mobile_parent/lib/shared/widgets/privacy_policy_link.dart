import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

// Supply only the approved public policy URL using --dart-define.
const _privacyPolicyUrl = String.fromEnvironment('MADAR_PRIVACY_POLICY_URL');

class PrivacyPolicyLink extends StatelessWidget {
  const PrivacyPolicyLink({super.key});

  @override
  Widget build(BuildContext context) {
    final uri = Uri.tryParse(_privacyPolicyUrl.trim());
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty) {
      return const SizedBox.shrink();
    }

    return TextButton(
      onPressed: () async {
        var opened = false;
        try {
          opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
        } catch (_) {
          // Show a useful error if the browser is unavailable.
        }
        if (!opened && context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('تعذر فتح سياسة الخصوصية.')),
          );
        }
      },
      child: const Text('سياسة الخصوصية'),
    );
  }
}
