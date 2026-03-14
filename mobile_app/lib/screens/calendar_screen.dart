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
    final monthLabel = DateFormat('MMMM yyyy').format(_focusedDay).toUpperCase();
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: colorScheme.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text('TIMELINE', style: GoogleFonts.outfit(fontWeight: FontWeight.w900, letterSpacing: 2, fontSize: 18)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(monthLabel, style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white54, letterSpacing: 1)),
                      Row(
                        children: [
                          _navBtn(Icons.chevron_left, () => setState(() => _focusedDay = _focusedDay.subtract(const Duration(days: 7)))),
                          const SizedBox(width: 8),
                          _navBtn(Icons.chevron_right, () => setState(() => _focusedDay = _focusedDay.add(const Duration(days: 7)))),
                        ],
                      )
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Expanded(
                  child: GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 7,
                      childAspectRatio: 0.45,
                      crossAxisSpacing: 8,
                    ),
                    itemCount: 7,
                    itemBuilder: (context, index) {
                      final day = week[index];
                      final dateStr = DateFormat('yyyy-MM-dd').format(day);
                      final dayEntries = _entries.where((e) => e['date'] == dateStr).toList();
                      final totalHours = dayEntries.fold(0.0, (sum, e) => sum + (e['hours'] as num));
                      final hasOT = dayEntries.any((e) => e['isOvertime'] == true);
                      final isToday = dateStr == DateFormat('yyyy-MM-dd').format(DateTime.now());

                      return Column(
                        children: [
                          Text(DateFormat('E').format(day).toUpperCase(), style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w800, color: isToday ? colorScheme.primary : Colors.white24)),
                          const SizedBox(height: 8),
                          Expanded(
                            child: Container(
                              decoration: BoxDecoration(
                                color: isToday ? colorScheme.primary.withOpacity(0.15) : Colors.white.withOpacity(0.03),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: isToday ? colorScheme.primary.withOpacity(0.5) : Colors.white.withOpacity(0.05)),
                              ),
                              child: Column(
                                children: [
                                  const SizedBox(height: 12),
                                  Text(day.day.toString(), style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w900, color: isToday ? colorScheme.primary : Colors.white)),
                                  const Spacer(),
                                  if (totalHours > 0) ...[
                                    Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
                                      decoration: BoxDecoration(
                                        color: hasOT ? Colors.orange.withOpacity(0.1) : colorScheme.secondary.withOpacity(0.1),
                                        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(11)),
                                      ),
                                      child: Column(
                                        children: [
                                          Text('${totalHours}h', style: TextStyle(fontSize: 10, fontWeight: FontWeight.black, color: hasOT ? Colors.orangeAccent : colorScheme.secondary)),
                                          if (hasOT) const Text('OT', style: TextStyle(fontSize: 7, fontWeight: FontWeight.bold, color: Colors.orangeAccent)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(24),
                  child: const Text('FULL LOGS AVAILABLE ON WEB', style: TextStyle(color: Colors.white10, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 2)),
                )
              ],
            ),
    );
  }

  Widget _navBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(8)),
        child: Icon(icon, size: 20, color: Colors.white54),
      ),
    );
  }
}
