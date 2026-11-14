# Meteor embroidery studio

Meteor turns artwork and lettering into machine embroidery. It exports Brother PES and Tajima DST files.

**Meteor is in beta.** Every feature is unlocked and free while the beta runs.

See what it does on the [Meteor website](https://beelito.github.io/meteor-embroidery-studio/).

## Download

| Your computer | Download |
| --- | --- |
| Windows 10 or 11 | [Meteor installer for Windows](https://github.com/beelito/meteor-embroidery-studio/releases/latest/download/meteor-windows-setup.exe) |
| Mac (Apple silicon or Intel) | [Meteor for Mac](https://github.com/beelito/meteor-embroidery-studio/releases/latest/download/meteor-macos.dmg) |
| Android tablet | [Meteor for Android (APK)](https://github.com/beelito/meteor-embroidery-studio/releases/latest/download/meteor-android.apk) |
| Linux (64-bit) | [Meteor for Linux](https://github.com/beelito/meteor-embroidery-studio/releases/latest/download/meteor-linux-x64.tar.gz) |

These links always get the newest version. Older versions and release notes are on the [Releases page](https://github.com/beelito/meteor-embroidery-studio/releases).

## Install

### Windows

1. Open `meteor-windows-setup.exe` from your Downloads folder.
2. Windows may show **"Windows protected your PC"**. This appears because the beta installer is not yet signed with a paid certificate. Click **More info**, then **Run anyway**.
3. Follow the installer. It does not need an administrator password.
4. Open Meteor from the Start menu.

To update, download the installer again and run it. Your designs stay. To uninstall, go to **Settings > Apps > Installed apps > Meteor**.

If the installer does not work for you, the [portable zip](https://github.com/beelito/meteor-embroidery-studio/releases/latest/download/meteor-windows-x64.zip) runs without installing: extract the whole folder, then open `meteor.exe`.

### Mac

Meteor runs on macOS 10.15 or later, on Apple silicon and Intel Macs.

1. Open `meteor-macos.dmg`. In the window that opens, drag **Meteor** onto the **Applications** folder.
2. Open Meteor from Applications or Launchpad. macOS says it could not verify Meteor, because the beta is not yet notarized by Apple. Choose **Done**.
3. Open **System Settings > Privacy & Security**, scroll to **Security**, choose **Open Anyway** beside Meteor, and confirm. From then on Meteor opens like any other app.

On macOS 14 or earlier, you can Control-click Meteor in Applications instead, then choose **Open** twice.

To update, download the disk image again, drag Meteor to Applications and choose **Replace**. Your designs stay. To uninstall, drag Meteor from Applications to the Trash.

If the disk image does not work for you, [`meteor-macos.zip`](https://github.com/beelito/meteor-embroidery-studio/releases/latest/download/meteor-macos.zip) holds the app alone: open it, then drag Meteor to Applications.

### Android tablet

1. Download `meteor-android.apk` on the tablet.
2. Open it from the download notification or the **Files** app.
3. Android asks to allow installs from your browser or Files app. Tap **Settings**, turn on **Allow from this source**, then go back and tap **Install**.
4. Google Play Protect may warn about an unknown app. Tap **More details > Install anyway**.

To update, download the newest APK and install it over the old one. Your designs stay.

### Linux

1. Extract the download: `tar xzf meteor-linux-x64.tar.gz`
2. Run `meteor/embroidream`.
3. To add Meteor to your app launcher, run `meteor/data/packaging/install_linux.sh`.

Meteor needs GTK 3, which most desktops already have. Opening and saving files uses `zenity` or `kdialog`.

## Report a problem

In Meteor, open **Help > Report a problem**. It puts together a report for you to send. Nothing is sent automatically.

Send the report as a [new issue](https://github.com/beelito/meteor-embroidery-studio/issues/new/choose) here, or by email to beelito.dev@gmail.com.

## Source code

Meteor is not open source. This page only hosts the downloads.
