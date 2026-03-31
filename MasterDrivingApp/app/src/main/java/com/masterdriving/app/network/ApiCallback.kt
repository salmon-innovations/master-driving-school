package com.masterdriving.app.network

interface ApiCallback<T> {
    fun onSuccess(result: T)
    fun onError(message: String)
}
