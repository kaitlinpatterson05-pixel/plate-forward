/*
  Plate Forward light wall
  ------------------------
  Every 5 seconds this asks your website how many volunteers have booked TODAY,
  then turns on that many lights in white.
  At midnight (Melbourne time) the website's count goes back to 0,
  so the lights switch off and the wall starts fresh for the new day.

  YOU ONLY NEED TO CHANGE THE 3 LINES MARKED  <-- CHANGE THIS
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Adafruit_NeoPixel.h>

const char* WIFI_NAME     = "your-wifi-name";                               // <-- CHANGE THIS
const char* WIFI_PASSWORD = "your-wifi-password";                           // <-- CHANGE THIS
const char* LIGHTS_URL    = "https://YOUR-SITE.netlify.app/api/lights";     // <-- CHANGE THIS

const int DATA_PIN   = 16;   // the ESP32 pin the lights' data wire plugs into
const int NUM_LIGHTS = 100;  // your two 50-light strings joined together
const int BRIGHTNESS = 204;  // 0 (off) to 255 (full)
const unsigned long CHECK_EVERY_MS = 5000;

Adafruit_NeoPixel strip(NUM_LIGHTS, DATA_PIN, NEO_GRB + NEO_KHZ800);
int litNow = 0;  // how many lights are on right now

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(500); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected!" : " not connected yet, will retry.");
}

int askWebsite() {
  WiFiClientSecure client;
  client.setInsecure();               // keeps setup simple (no certificates to install)
  HTTPClient http;
  if (!http.begin(client, LIGHTS_URL)) return -1;
  int code = http.GET();
  int count = -1;
  if (code == 200) count = http.getString().toInt();
  else { Serial.print("Website answered with code "); Serial.println(code); }
  http.end();
  return count;
}

// fades one light up to white so new volunteers get a little glow-up moment
void fadeOn(int i) {
  for (int b = 0; b <= 255; b += 15) {
    strip.setPixelColor(i, strip.Color(b, b, b));
    strip.show();
    delay(20);
  }
}

void setup() {
  Serial.begin(115200);
  strip.begin();
  strip.setBrightness(BRIGHTNESS);
  strip.clear();
  strip.show();
  connectWiFi();
}

void loop() {
  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    int count = askWebsite();
    if (count >= 0) {                        // if the website can't be reached, lights just stay as they are
      count = constrain(count, 0, NUM_LIGHTS);
      if (count > litNow) {
        for (int i = litNow; i < count; i++) fadeOn(i);
      } else if (count < litNow) {           // happens at midnight when the day resets
        for (int i = count; i < litNow; i++) strip.setPixelColor(i, 0);
        strip.show();
      }
      if (count != litNow) { Serial.print("Lights on: "); Serial.println(count); }
      litNow = count;
    }
  }
  delay(CHECK_EVERY_MS);
}
