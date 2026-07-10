package com.goldscalp.signals;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TradingServicePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
