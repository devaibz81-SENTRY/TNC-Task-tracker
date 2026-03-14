import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import '../services/convex_service.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  List<dynamic> _entries = [];
  Map<String, dynamic>? _user;
  DateTime _focusedDay = DateTime.now();
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final prefs = await SharedPreferences.getInstance();
    final userStr = prefs.getString('user');
    if (userStr != null) {
      _user = jsonDecode(userStr);
      final convex = context.read<ConvexService>();
      final entries = await convex.getTimeEntries(_user!['_id']);
      setState(() {
        _entries = entries;
        _isLoading = false;
      });
    }
  }

  List<DateTime> _getWeekDays(DateTime focused) {
    final sunday = focused.subtract(Duration(days: focused.weekday % 7));
    return List.generate(7, (i) => sunday.add(Duration(days: i)));
  }

  @override
  Widget build(BuildContext context) {
    final week = _getWeekDays(_focusedDay);
    final monthLabel = DateFormat('MMMM yyyy').format(_focusedDay);

    return Scaffold(
      appBar: AppBar(title: const Text('Weekly Calendar')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(monthLabel, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      Row(
                        children: [
                          IconButton(onPressed: () => setState(() => _focusedDay = _focusedDay.subtract(const Duration(days: 7))), icon: const Icon(Icons.chevron_left)),
                          IconButton(onPressed: () => setState(() => _focusedDay = _focusedDay.add(const Duration(days: 7))), icon: const Icon(Icons.chevron_right)),
                        ],
                      )
                    ],
                  ),
                ),
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 7,
                      childAspectRatio: 0.5,
                      crossAxisSpacing: 4,
                    ),
                    itemCount: 7,
                    itemBuilder: (context, index) {
                      final day = week[index];
                      final dateStr = DateFormat('yyyy-MM-dd').format(day);
                      final dayEntries = _entries.where((e) => e['date'] == dateStr).toList();
                      final totalHours = dayEntries.fold(0.0, (sum, e) => sum + (e['hours'] as num));
                      final hasOT = dayEntries.any((e) => e['isOvertime'] == true);
                      final isToday = dateStr == DateFormat('yyyy-MM-dd').format(DateTime.now());

                      return Container(
                        decoration: BoxDecoration(
                          color: isToday ? Colors.indigo.withOpacity(0.2) : Colors.white.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(8),
                          border: isToday ? Border.all(color: Colors.indigo, width: 2) : null,
                        ),
                        child: Column(
                          children: [
                            const SizedBox(height: 8),
                            Text(DateFormat('E').format(day), style: const TextStyle(fontSize: 10, color: Colors.white60)),
                            Text(day.day.toString(), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                            const Spacer(),
                            if (totalHours > 0) ...[
                              Text('${totalHours}h', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: hasOT ? Colors.orange : Colors.cyanAccent)),
                              if (hasOT) const Text('OT', style: TextStyle(fontSize: 8, color: Colors.orange)),
                            ],
                            const SizedBox(height: 8),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text('More analytics in web dashboard', style: TextStyle(color: Colors.white30, fontSize: 12)),
                )
              ],
            ),
    );
  }
}
