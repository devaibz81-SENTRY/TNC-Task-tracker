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
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'TNC',
                style: TextStyle(
                  fontSize: 48,
                  fontWeight: FontWeight.w900,
                  foreground: Paint()..shader = LinearGradient(
                    colors: [colorScheme.primary, colorScheme.secondary],
                  ).createShader(const Rect.fromLTWH(0, 0, 200, 70)),
                ),
              ),
              const Text('Task & Overtime Tracker', style: TextStyle(color: Colors.white70)),
              const SizedBox(height: 48),

              if (_assignedPin != null) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: colorScheme.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: colorScheme.secondary),
                  ),
                  child: Column(
                    children: [
                      const Text('Your assigned PIN', style: TextStyle(fontSize: 12, color: Colors.white60)),
                      Text(
                        _assignedPin!['pin'],
                        style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: colorScheme.secondary),
                      ),
                      const Text('Write this down to log in!', style: TextStyle(fontSize: 12, color: Colors.white60)),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],

              TextField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: 'Name',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.person),
                ),
              ),
              const SizedBox(height: 16),
              if (_isLogin)
                TextField(
                  controller: _pinController,
                  obscureText: true,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  decoration: const InputDecoration(
                    labelText: '4-Digit PIN',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.lock),
                  ),
                ),

              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _handleAuth,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colorScheme.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(_isLogin ? 'Login' : 'Sign Up'),
                ),
              ),
              TextButton(
                onPressed: () => setState(() {
                  _isLogin = !_isLogin;
                  _assignedPin = null;
                }),
                child: Text(_isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
