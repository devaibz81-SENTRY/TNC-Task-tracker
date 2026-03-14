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
      appBar: AppBar(
        title: const Text('Dashboard', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CalendarScreen())), icon: const Icon(Icons.calendar_month)),
          IconButton(onPressed: () async {
            final prefs = await SharedPreferences.getInstance();
            await prefs.clear();
            if (mounted) Navigator.of(context).pop();
          }, icon: const Icon(Icons.logout)),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchData,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Stats Area
                  Row(
                    children: [
                      _statCard('Today', '${todayHours}h', colorScheme.secondary),
                      const SizedBox(width: 12),
                      _statCard('Active', '${_tasks.where((t) => t['status'] != 'completed').length}', Colors.greenAccent),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text('Your Tasks', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  ..._tasks.map((task) => _taskCard(task, colorScheme)),
                ],
              ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddTaskDialog(),
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 12, color: Colors.white60)),
            Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _taskCard(Map<String, dynamic> task, ColorScheme colorScheme) {
    final bool isCompleted = task['status'] == 'completed';
    final bool isRunning = _activeTaskId == task['_id'];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: isRunning ? colorScheme.primary.withOpacity(0.1) : null,
      child: ListTile(
        title: Text(task['title'], style: TextStyle(decoration: isCompleted ? TextDecoration.lineThrough : null)),
        subtitle: isRunning
            ? Text('Running: $_stopwatchText', style: TextStyle(color: colorScheme.secondary, fontWeight: FontWeight.bold))
            : Text(task['status']),
        trailing: isCompleted
            ? const Icon(Icons.check_circle, color: Colors.green)
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: Icon(isRunning ? Icons.stop_circle : Icons.play_circle),
                    color: isRunning ? Colors.red : colorScheme.primary,
                    onPressed: () => isRunning ? _stopTimer(task['_id']) : _startTimer(task['_id']),
                  ),
                  IconButton(
                    icon: const Icon(Icons.done),
                    onPressed: () => _markDone(task['_id']),
                  ),
                ],
              ),
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
