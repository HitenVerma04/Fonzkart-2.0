# Android build environment for the Fonzkart apps: Node 22 + JDK 17 + Android command-line tools.
# Gradle downloads the SDK platform, build tools, NDK and CMake it needs into ANDROID_HOME on first build
# (mount a named volume there to keep them between builds). See mobile/README.md, "Android APK".
FROM node:22-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-17-jdk-headless unzip \
 && rm -rf /var/lib/apt/lists/*

# IPv4 only: on Docker Desktop without working IPv6, Java waits ~20 s per connection and Gradle's downloads time out.
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    ANDROID_HOME=/opt/android-sdk \
    JAVA_TOOL_OPTIONS=-Djava.net.preferIPv4Stack=true
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN mkdir -p $ANDROID_HOME/cmdline-tools \
 && curl -fsSLo /tmp/tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
 && unzip -q /tmp/tools.zip -d $ANDROID_HOME/cmdline-tools \
 && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
 && rm /tmp/tools.zip \
 && yes | sdkmanager --licenses > /dev/null \
 && sdkmanager "platform-tools" > /dev/null

COPY build.sh /usr/local/bin/build-apk
ENTRYPOINT ["sh", "/usr/local/bin/build-apk"]
