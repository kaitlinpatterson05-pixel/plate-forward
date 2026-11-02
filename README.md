# Plate Forward: website + light wall

How it fits together:

    Volunteer books on your website
            ↓
    Netlify saves the booking
            ↓
    yoursite.netlify.app/api/lights  shows today's number, e.g. 12
            ↓
    ESP32 board checks that number every 5 seconds
            ↓
    It turns on that many lights
            ↓
    At midnight (Melbourne time) the number goes back to 0,
    the lights switch off, and the next day starts fresh

## What's in this folder

- public/index.html   your website
- public/admin.html   your private bookings list (at /admin.html)
- netlify/functions/api.mjs   saves bookings and gives the light count
- esp32/plate_forward_lights/plate_forward_lights.ino   program for the light controller

## Part 1: put the website online (about 15 minutes)

Netlify's drag-and-drop upload can't run the booking part, so it goes through GitHub (free):

1. Make a free account at github.com. Click **New repository**, name it `plate-forward`, click **Create**.
2. Click **uploading an existing file**. Unzip this folder on your computer, open it, select everything inside, and drag it in. Click **Commit changes**.
3. In Netlify: **Add new site → Import an existing project → GitHub**, pick `plate-forward`, click **Deploy**. Leave all settings as they are.
4. In Netlify go to **Site configuration → Environment variables → Add a variable**.
   Key: `ADMIN_KEY`. Value: a password only you know. Then go to **Deploys → Trigger deploy**.
5. Test it: open `https://YOUR-SITE.netlify.app/api/lights`. You should see `0`.

To see who booked: open `https://YOUR-SITE.netlify.app/admin.html` and type your ADMIN_KEY.

## Part 2: parts for the lights (no soldering)

- ESP32 dev board **with headers already soldered on** (Jaycar or Core Electronics)
- USB cable + phone charger to power the ESP32
- 5V power supply, 4A or more, for the lights (check your light strings say 5V)
- DC barrel jack to screw-terminal adapter (wires go in with a small screwdriver)
- Female-to-female jumper wires
- Lever wire connectors (like Wago 221): push a wire in, clip the lever down
- A 3-pin JST SM connector lead that matches your light strings' plug, so you get bare wire ends

## Part 3: wiring

Your light strings have 3 wires. Usually red is **5V +**, white or black is **GND −**, green is **DATA**. Check the labels on the strip.
Connect at the **input end** (the end the little arrows point away from).

| From | To |
|---|---|
| Power supply **+** (screw terminal) | Lights **red (5V)** |
| Power supply **−** (screw terminal) | Lights **white (GND)** |
| Lights **white (GND)** | ESP32 pin **GND** (the grounds must be joined) |
| Lights **green (DATA)** | ESP32 pin **16** (may say G16 or IO16) |
| ESP32 USB port | Phone charger |

Don't power the lights from the ESP32. 100 lights need their own power supply.
Plug your two 50-light strings together end to end so they act as one line of 100.

## Part 4: put the program on the ESP32

1. Install **Arduino IDE** (free, from arduino.cc).
2. **File → Preferences**. In "Additional boards manager URLs" paste:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. **Tools → Board → Boards Manager**: search `esp32`, install **esp32 by Espressif**.
4. **Tools → Manage Libraries**: search `Adafruit NeoPixel`, install it.
5. Open `esp32/plate_forward_lights/plate_forward_lights.ino`. Change the 3 lines marked `<-- CHANGE THIS`: WiFi name, WiFi password, and your Netlify address.
6. Plug the ESP32 into your computer. Pick **Tools → Board → ESP32 Dev Module** and **Tools → Port** (the new one that appeared).
7. Click the **→ Upload** arrow. If it sticks on "Connecting…", hold the **BOOT** button on the board until it starts.
8. Open **Tools → Serial Monitor** (set to 115200). You should see "connected!" and "Lights on: …".

Book a test shift on your website. Within 5 seconds a light fades on. It stays on until midnight, when the wall resets.

## Tips

- The ESP32 only joins **2.4 GHz** WiFi. A phone hotspot usually works.
- WiFi that makes you log in on a web page (like uni WiFi) won't work. Use a phone hotspot or a normal home router.
- If the lights show odd colours or flicker, check the GND wire is joined to the ESP32.
