import 'dart:convert';
import 'package:http/http.dart' as http;

class ConvexService {
  final String baseUrl = "https://cheery-tortoise-233.convex.cloud";

  // POST request to Convex HTTP API
  Future<dynamic> _post(String functionName, Map<String, dynamic> args) async {
    final response = await http.post(
      Uri.parse("$baseUrl/api/mutation/$functionName"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(args),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception("Convex Mutation Error ($functionName): ${response.body}");
    }
  }

  // GET request to Convex HTTP API
  Future<dynamic> _get(String functionName, Map<String, dynamic> args) async {
    // Convex GET queries use query params for args
    final uri = Uri.parse("$baseUrl/api/query/$functionName").replace(
      queryParameters: args.map((key, value) => MapEntry(key, value.toString())),
    );
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      // Convex HTTP GET wraps result in {"value": ...}
      return decoded['value'];
    } else {
      throw Exception("Convex Query Error ($functionName): ${response.body}");
    }
  }

  // Auth
  Future<Map<String, dynamic>> login(String username, String pin) async {
    final result = await _get("users:login", {"username": username, "pin": pin});
    return Map<String, dynamic>.from(result);
  }

  Future<Map<String, dynamic>> signup(String username) async {
    final result = await _post("users:signup", {"username": username, "isAdmin": false});
    return Map<String, dynamic>.from(result);
  }

  // Tasks
  Future<List<dynamic>> getTasks(String userId) async {
    final result = await _get("tasks:getUserTasks", {"userId": userId});
    return result as List<dynamic>;
  }

  Future<void> createTask(String userId, String title, String description) async {
    await _post("tasks:createTask", {
      "userId": userId,
      "title": title,
      "description": description,
    });
  }

  Future<void> updateTaskStatus(String taskId, String status) async {
    await _post("tasks:updateTaskStatus", {
      "taskId": taskId,
      "status": status,
    });
  }

  // Time Entries
  Future<List<dynamic>> getTimeEntries(String userId) async {
    final result = await _get("time_entries:getUserTimeEntries", {"userId": userId});
    return result as List<dynamic>;
  }

  Future<void> logTime({
    required String userId,
    required String taskId,
    required double hours,
    required bool isOvertime,
    required String date,
    int? startTime,
    int? endTime,
  }) async {
    await _post("time_entries:logTime", {
      "userId": userId,
      "taskId": taskId,
      "hours": hours,
      "isOvertime": isOvertime,
      "date": date,
      if (startTime != null) "startTime": startTime,
      if (endTime != null) "endTime": endTime,
    });
  }
}
