#!/bin/sh
# Builds an installable release APK of one app inside the android-build image.
#   /work = the mobile/ workspace with node_modules installed, /out = where the APK is copied.
#   build-apk customer|partner|admin [abi...]   (default ABI: arm64-v8a, which covers current Android phones)
# The APK is signed with the Expo template's debug key: fine for direct installs, not for Google Play.
set -e
APP=${1:?usage: build-apk customer|partner|admin [abi...]}
shift
ABIS=$(echo "${*:-arm64-v8a}" | tr ' ' ',')

cd /work/apps/"$APP"
VERSION=$(node -p "require('./app.json').expo.version")
npx expo prebuild --platform android --clean --no-install

cd android
# Gradle itself comes from GitHub's download host, which can take ~20 s to answer from Docker Desktop;
# the wrapper's default 10 s timeout then fails the build. Downloaded once, then cached in /root/.gradle.
sed -i 's/^networkTimeout=.*/networkTimeout=120000/' gradle/wrapper/gradle-wrapper.properties
# If the container cannot reach that host at all, download the same Gradle zip elsewhere and mount its folder
# at /gradle-dist; the wrapper then installs it from there (it still checks distributionSha256Sum when set).
if [ -d /gradle-dist ]; then
  ZIP=$(sed -n 's#^distributionUrl=.*/\(gradle-[^/]*\.zip\)$#\1#p' gradle/wrapper/gradle-wrapper.properties)
  if [ -f "/gradle-dist/$ZIP" ]; then
    sed -i "s#^distributionUrl=.*#distributionUrl=file:/gradle-dist/$ZIP#" gradle/wrapper/gradle-wrapper.properties
  fi
fi
./gradlew --no-daemon assembleRelease -PreactNativeArchitectures="$ABIS"

mkdir -p /out
cp app/build/outputs/apk/release/app-release.apk "/out/fonzkart-$APP-$VERSION.apk"
echo "APK: fonzkart-$APP-$VERSION.apk ($ABIS)"
