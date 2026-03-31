package com.masterdriving.app.network

import org.json.JSONArray
import org.json.JSONObject

/**
 * A sealed class representing the result of a network operation.
 * This is a idiomatic Kotlin way to handle success and failure.
 */
sealed class NetworkResult<out T> {
    data class Success<out T>(val data: T) : NetworkResult<T>()
    data class Error(val message: String, val exception: Exception? = null) : NetworkResult<Nothing>()
    object Loading : NetworkResult<Nothing>()
}

/**
 * Extension function to safely execute network calls and catch exceptions.
 * Uses Kotlin's high-order functions.
 */
suspend fun <T> safeApiCall(apiCall: suspend () -> T): NetworkResult<T> {
    return try {
        NetworkResult.Success(apiCall())
    } catch (e: Exception) {
        NetworkResult.Error(e.message ?: "An unknown error occurred", e)
    }
}

/**
 * Extension properties for JSONObject to get strings safely.
 */
fun JSONObject.optStringOrNull(key: String): String? {
    return if (has(key) && !isNull(key)) optString(key) else null
}

/**
 * Map elements of a JSONArray to a list of objects.
 */
fun <T> JSONArray.toList(mapper: (JSONObject) -> T): List<T> {
    val list = mutableListOf<T>()
    for (i in 0 until length()) {
        val item = optJSONObject(i)
        if (item != null) {
            list.add(mapper(item))
        }
    }
    return list
}
