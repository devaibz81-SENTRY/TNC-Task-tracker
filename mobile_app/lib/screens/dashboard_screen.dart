import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'dart:async';
import '../services/convex_service.dart';
import 'calendar_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _user;
  List<dynamic> _tasks = [];
  List<dynamic> _entries = [];
  bool _isLoading = true;
  Timer? _refreshTimer;

  // Stream Timer State
  String? _activeTaskId;
  DateTime? _timerStart;
  String _stopwatchText = "00:00";
  Timer? _stopwatchTimer;

  @override
  void initState() {
    super.initState();
    _loadUser();
    _fetchData();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) => _fetchData());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _stopwatchTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadUser() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString('user');
    if (userStr != null) {
      setState(() => _user = jsonDecode(userStr));
    }
  }

  Future<void> _fetchData() async {
    if (_user == null) return;
    final convex = context.read<ConvexService>();
    try {
      final tasks = await convex.getTasks(_user!['_id']);
      final entries = await convex.getTimeEntries(_user!['_id']);
      setState(() {
        _tasks = tasks;
        _entries = entries;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint("Fetch error: $e");
    }
  }

  void _startTimer(String taskId) {
    if (_activeTaskId != null) _stopTimer(_activeTaskId!);

    setState(() {
      _activeTaskId = taskId;
      _timerStart = DateTime.now();
      _stopwatchText = "00:00";
    });

    _stopwatchTimer?.cancel();
    _stopwatchTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      final diff = DateTime.now().difference(_timerStart!);
      setState(() {
        _stopwatchText = _formatDuration(diff);
      });
    });
  }

  String _formatDuration(Duration d) {
    String twoDigits(int n) => n.toString().padLeft(2, "0");
    if (d.inHours > 0) {
      return "${d.inHours}:${twoDigits(d.inMinutes.remainder(60))}:${twoDigits(d.inSeconds.remainder(60))}";
    }
    return "${twoDigits(d.inMinutes.remainder(60))}:${twoDigits(d.inSeconds.remainder(60))}";
  }

  Future<void> _stopTimer(String taskId) async {
    final duration = DateTime.now().difference(_timerStart!);
    final hours = (duration.inMinutes / 60.0 * 4).round() / 4.0;

    _stopwatchTimer?.cancel();
    setState(() {
      _activeTaskId = null;
      _timerStart = null;
      _stopwatchText = "00:00";
    });

    if (hours < 0.25) return;

    final isOT = await _promptOT(hours);
    if (isOT == null) return; // Cancelled

    final convex = context.read<ConvexService>();
    try {
      await convex.logTime(
        userId: _user!['_id'],
        taskId: taskId,
        hours: hours,
        isOvertime: isOT,
        date: DateTime.now().toIso8601String().substring(0, 10),
      );
      _fetchData();
    } catch (e) {
      debugPrint("Log error: $e");
    }
  }

  Future<bool?> _promptOT(double hours) async {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Log Time'),
        content: Text('Log $hours hours?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Regular')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Overtime', style: TextStyle(color: Colors.orange))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final todayHours = _entries.where((e) => e['date'] == today).fold(0.0, (sum, e) => sum + (e['hours'] as num));

    return Scaffold(
      backgroundColor: colorScheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'DASHBOARD',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w900, letterSpacing: 1.5, fontSize: 18),
        ),
        actions: [
          IconButton(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CalendarScreen())),
            icon: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), shape: BoxShape.circle),
              child: const Icon(Icons.calendar_view_week, size: 20),
            ),
          ),
          IconButton(
            onPressed: () async {
              final prefs = await SharedPreferences.getInstance();
              await prefs.clear();
              if (mounted) Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
            },
            icon: const Icon(Icons.logout, size: 20, color: Colors.white38),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchData,
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                children: [
                  // Profile Section
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: colorScheme.primary.withOpacity(0.2),
                        child: Text(_user?['username']?[0]?.toUpperCase() ?? 'U', style: TextStyle(color: colorScheme.primary, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Welcome back,', style: TextStyle(color: Colors.white30, fontSize: 12)),
                          Text(_user?['username'] ?? 'User', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Stats Row
                  Row(
                    children: [
                      _statCard('Today', '${todayHours}h', colorScheme.primary),
                      const SizedBox(width: 16),
                      _statCard('Pending', '${_tasks.where((t) => t['status'] != 'completed').length}', colorScheme.secondary),
                    ],
                  ),
                  const SizedBox(height: 32),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('MY TASKS', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white54, letterSpacing: 1)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: colorScheme.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                        child: Text('${_tasks.length} total', style: TextStyle(fontSize: 10, color: colorScheme.primary, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  if (_tasks.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(40),
                      child: Column(
                        children: [
                          Icon(Icons.assignment_outlined, size: 64, color: Colors.white.withOpacity(0.1)),
                          const SizedBox(height: 16),
                          const Text('No tasks yet. Start by adding one!', style: TextStyle(color: Colors.white24)),
                        ],
                      ),
                    ),

                  ..._tasks.map((task) => _taskCard(task, colorScheme)),
                  const SizedBox(height: 80),
                ],
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddTaskDialog(),
        label: const Text('NEW TASK', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1)),
        icon: const Icon(Icons.add),
        backgroundColor: colorScheme.primary,
        elevation: 10,
      ),
    );
  }

  Widget _statCard(String label, String value, Color accent) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: accent.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
              child: Icon(label == 'Today' ? Icons.timer_outlined : Icons.list_alt, color: accent, size: 18),
            ),
            const SizedBox(height: 16),
            Text(value, style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.bold, color: Colors.white)),
            Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white24, letterSpacing: 1)),
          ],
        ),
      ),
    );
  }

  Widget _taskCard(Map<String, dynamic> task, ColorScheme colorScheme) {
    final bool isCompleted = task['status'] == 'completed';
    final bool isRunning = _activeTaskId == task['_id'];

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isRunning ? colorScheme.primary.withOpacity(0.08) : Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: isRunning ? colorScheme.primary.withOpacity(0.3) : Colors.white.withOpacity(0.05)),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        title: Text(
          task['title'],
          style: GoogleFonts.inter(
            fontWeight: FontWeight.w600,
            fontSize: 15,
            decoration: isCompleted ? TextDecoration.lineThrough : null,
            color: isCompleted ? Colors.white24 : Colors.white,
          ),
        ),
        subtitle: isRunning
            ? Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: colorScheme.secondary.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.bolt, size: 14, color: Colors.cyanAccent),
                    const SizedBox(width: 4),
                    Text('LIVE: $_stopwatchText', style: TextStyle(color: colorScheme.secondary, fontWeight: FontWeight.bold, fontSize: 12)),
                  ],
                ),
              )
            : Text(task['status'].toUpperCase(), style: const TextStyle(fontSize: 10, color: Colors.white24, fontWeight: FontWeight.bold, letterSpacing: 1)),
        trailing: isCompleted
            ? Icon(Icons.check_circle, color: colorScheme.secondary.withOpacity(0.5))
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _circleBtn(
                    icon: isRunning ? Icons.stop : Icons.play_arrow,
                    color: isRunning ? Colors.redAccent : colorScheme.primary,
                    onTap: () => isRunning ? _stopTimer(task['_id']) : _startTimer(task['_id']),
                  ),
                  const SizedBox(width: 8),
                  _circleBtn(
                    icon: Icons.done,
                    color: Colors.white10,
                    onTap: () => _markDone(task['_id']),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _circleBtn({required IconData icon, required Color color, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 20, color: color == Colors.white10 ? Colors.white38 : color),
      ),
    );
  }

  Future<void> _markDone(String taskId) async {
    if (_activeTaskId == taskId) _stopwatchTimer?.cancel();
    final convex = context.read<ConvexService>();
    try {
      await convex.updateTaskStatus(taskId, 'completed');
      _fetchData();
    } catch (e) {
      debugPrint(e.toString());
    }
  }

  void _showAddTaskDialog() {
    final titleCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('New Task'),
        content: TextField(controller: titleCtrl, decoration: const InputDecoration(hintText: 'Task Title')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              if (titleCtrl.text.isEmpty) return;
              final convex = context.read<ConvexService>();
              await convex.createTask(_user!['_id'], titleCtrl.text, "");
              if (mounted) Navigator.pop(context);
              _fetchData();
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }
}
