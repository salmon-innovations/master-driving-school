package com.masterdriving.app.network

import android.content.Context
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import com.masterdriving.app.network.NetworkResult
import com.masterdriving.app.network.safeApiCall
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ApiService(private val context: Context) {

    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }

    // ── AUTH (Coroutines) ──────────────────────────────────────────────────

    suspend fun login(email: String, password: String): JSONObject = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email)
            put("password", password)
        }
        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/auth/login")
            .post(body.toString().toRequestBody(JSON))
            .build()
        
        request.execute { JSONObject(it) }
    }

    suspend fun register(formData: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/auth/register")
            .post(formData.toString().toRequestBody(JSON))
            .build()
        
        request.execute { JSONObject(it) }
    }

    // ── COURSES (Coroutines) ───────────────────────────────────────────────

    suspend fun getCourses(): JSONArray = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/courses")
            .get()
            .build()
        
        request.execute { parseArray(it) }
    }

    // ── SCHEDULES (Coroutines) ─────────────────────────────────────────────

    suspend fun getScheduleSlots(date: String? = null): JSONArray = withContext(Dispatchers.IO) {
        val query = if (!date.isNullOrEmpty()) "?date=$date" else ""
        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/schedules/slots$query")
            .get()
            .build()
        
        request.execute { parseArray(it) }
    }

    suspend fun getEnrollments(): JSONArray = withContext(Dispatchers.IO) {
        val token = ApiClient.getToken(context)
        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/enrollments")
            .addHeader("Authorization", "Bearer ${token ?: ""}")
            .get()
            .build()
        
        request.execute { parseArray(it) }
    }

    suspend fun getBranches(): JSONArray = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/branches")
            .get()
            .build()
        
        request.execute { parseArray(it) }
    }

    suspend fun getNews(): JSONArray = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${ApiClient.BASE_URL}/news") // This assumes a /news endpoint exists or handles it gracefully
            .get()
            .build()
        
        request.execute { parseArray(it) }
    }

    suspend fun getBranchesResult(): NetworkResult<JSONArray> = safeApiCall { getBranches() }
    suspend fun getCoursesResult(): NetworkResult<JSONArray> = safeApiCall { getCourses() }
    suspend fun getNewsResult(): NetworkResult<JSONArray> = safeApiCall { getNews() }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    /** Low-level helper to execute a request and parse the response body */
    private suspend fun <T> Request.execute(parser: (String) -> T): T = suspendCancellableCoroutine { cont ->
        val client = ApiClient.getClient(context)
        val call = client.newCall(this)
        
        cont.invokeOnCancellation { call.cancel() }
        
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (cont.isActive) cont.resumeWithException(Exception("Connection error: ${e.message}"))
            }

            override fun onResponse(call: Call, response: Response) {
                if (!cont.isActive) return
                
                val bodyStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    try {
                        cont.resume(parser(bodyStr))
                    } catch (e: JSONException) {
                        cont.resumeWithException(Exception("Invalid response format"))
                    }
                } else {
                    var errorMsg = "Server error ${response.code}"
                    try {
                        val err = JSONObject(bodyStr)
                        errorMsg = err.optString("error", err.optString("message", errorMsg))
                    } catch (ignored: JSONException) {}
                    cont.resumeWithException(Exception(errorMsg))
                }
            }
        })
    }

    /** Robustly parse an array even if it's wrapped in an object */
    private fun parseArray(body: String): JSONArray {
        if (body.isEmpty()) return JSONArray()
        val trimmed = body.trim()
        
        return if (trimmed.startsWith("[")) {
            JSONArray(trimmed)
        } else if (trimmed.startsWith("{")) {
            val obj = JSONObject(trimmed)
            val wrapperKeys = arrayOf("data", "courses", "branches", "slots", "enrollments")
            var finalArray: JSONArray? = null
            for (key in wrapperKeys) {
                if (obj.has(key)) {
                    finalArray = obj.optJSONArray(key)
                    if (finalArray != null) break
                }
            }
            if (finalArray == null) {
                val keys = obj.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val valObj = obj.get(key)
                    if (valObj is JSONArray) {
                        finalArray = valObj
                        break
                    }
                }
            }
            finalArray ?: JSONArray()
        } else {
            JSONArray()
        }
    }

    fun register(formData: JSONObject, callback: ApiCallback<JSONObject>) = executeCallback({ register(formData) }, callback)
    fun getBranches(callback: ApiCallback<JSONArray>) = executeCallback({ getBranches() }, callback)
    fun getCourses(callback: ApiCallback<JSONArray>) = executeCallback({ getCourses() }, callback)
    fun getScheduleSlots(date: String?, callback: ApiCallback<JSONArray>) = executeCallback({ getScheduleSlots(date) }, callback)
    fun login(email: String, password: String, callback: ApiCallback<JSONObject>) = executeCallback({ login(email, password) }, callback)
    fun getEnrollments(callback: ApiCallback<JSONArray>) = executeCallback({ getEnrollments() }, callback)
    fun getNews(callback: ApiCallback<JSONArray>) = executeCallback({ getNews() }, callback)

    private fun <T> executeCallback(task: suspend () -> T, callback: ApiCallback<T>) {
        serviceScope.launch {
            try {
                val result = withContext(Dispatchers.IO) { task() }
                callback.onSuccess(result)
            } catch (e: Exception) {
                callback.onError(e.message ?: "Task failed")
            }
        }
    }
}
