import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../services/convex_service.dart';
import 'dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _nameController = TextEditingController();
  final _pinController = TextEditingController();
  bool _isLogin = true;
  bool _isLoading = false;
  Map<String, dynamic>? _assignedPin;

  Future<void> _handleAuth() async {
    if (_nameController.text.isEmpty) return;
    if (_isLogin && _pinController.text.length < 4) return;

    setState(() => _isLoading = true);
    final convex = context.read<ConvexService>();

    try {
      if (_isLogin) {
        final res = await convex.login(_nameController.text.trim(), _pinController.text.trim());
        if (res['success']) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('user', jsonEncode(res['user']));
          if (mounted) {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const DashboardScreen()),
            );
          }
        } else {
          _showError(res['message']);
        }
      } else {
        final res = await convex.signup(_nameController.text.trim());
        if (res['success']) {
          setState(() {
            _assignedPin = res;
            _isLogin = true;
            _pinController.text = res['pin'];
          });
        } else {
          _showError(res['message']);
        }
      }
    } catch (e) {
      _showError(e.toString());
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.red));
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topLeft,
            radius: 1.5,
            colors: [
              colorScheme.primary.withOpacity(0.1),
              colorScheme.background,
            ],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo Section
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      colors: [colorScheme.primary, colorScheme.secondary],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: colorScheme.primary.withOpacity(0.3),
                        blurRadius: 30,
                        spreadRadius: 5,
                      )
                    ],
                  ),
                  child: const Icon(Icons.bolt, size: 60, color: Colors.white),
                ),
                const SizedBox(height: 32),
                Text(
                  'TNC TRACKER',
                  style: GoogleFonts.outfit(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2,
                    foreground: Paint()..shader = LinearGradient(
                      colors: [Colors.white, Colors.white.withOpacity(0.7)],
                    ).createShader(const Rect.fromLTWH(0, 0, 200, 70)),
                  ),
                ),
                const Text('Precision Time Management', style: TextStyle(color: Colors.white30, letterSpacing: 1)),
                const SizedBox(height: 64),

                if (_assignedPin != null) ...[
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: 1),
                    duration: const Duration(milliseconds: 500),
                    builder: (context, value, child) {
                      return Transform.scale(
                        scale: value,
                        child: Opacity(opacity: value, child: child),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: colorScheme.secondary.withOpacity(0.5)),
                      ),
                      child: Column(
                        children: [
                          const Text('YOUR ASSIGNED PIN', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white54)),
                          const SizedBox(height: 8),
                          Text(
                            _assignedPin!['pin'],
                            style: TextStyle(fontSize: 48, fontWeight: FontWeight.w900, color: colorScheme.secondary, letterSpacing: 8),
                          ),
                          const SizedBox(height: 8),
                          const Text('Please save this for future logins', style: TextStyle(fontSize: 11, color: Colors.white38)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],

                _buildTextField(_nameController, 'Username', Icons.person_outline),
                const SizedBox(height: 20),
                if (_isLogin)
                  _buildTextField(_pinController, '4-Digit PIN', Icons.lock_outline, isPassword: true, isNumber: true),

                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _handleAuth,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: colorScheme.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 8,
                      shadowColor: colorScheme.primary.withOpacity(0.5),
                    ),
                    child: _isLoading
                        ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text(_isLogin ? 'LOG IN' : 'GET STARTED', style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.5)),
                  ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => setState(() {
                    _isLogin = !_isLogin;
                    _assignedPin = null;
                  }),
                  child: Text(
                    _isLogin ? "DON'T HAVE AN ACCOUNT? SIGN UP" : "ALREADY TRACKING? LOG IN",
                    style: TextStyle(color: colorScheme.secondary, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField(TextEditingController controller, String label, IconData icon, {bool isPassword = false, bool isNumber = false}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
      ),
      child: TextField(
        controller: controller,
        obscureText: isPassword,
        keyboardType: isNumber ? TextInputType.number : TextInputType.text,
        maxLength: isNumber ? 4 : null,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          counterText: '',
          labelText: label,
          labelStyle: const TextStyle(color: Colors.white54, fontSize: 14),
          prefixIcon: Icon(icon, color: Colors.white38),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        ),
      ),
    );
  }
}
