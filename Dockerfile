FROM debian:buster-slim

ARG hlds_build=7882
ARG amxmod_version=1.8.2
ARG jk_botti_version=1.43
ARG steamcmd_url=https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz
ARG hlds_url="https://github.com/DevilBoy-eXe/hlds/releases/download/$hlds_build/hlds_build_$hlds_build.zip"
ARG metamod_url="https://github.com/mittorn/metamod-p/releases/download/1/metamod.so"
ARG amxmod_url="http://www.amxmodx.org/release/amxmodx-$amxmod_version-base-linux.tar.gz"
ARG jk_botti_url="http://koti.kapsi.fi/jukivili/web/jk_botti/jk_botti-$jk_botti_version-release.tar.xz"

ENV XASH3D_BASEDIR=/opt/steam/xashds

# Fix warning:
# WARNING: setlocale('en_US.UTF-8') failed, using locale: 'C'.
# International characters may not work.
RUN apt-get update && apt-get install -y --no-install-recommends \
    locales \
 && rm -rf /var/lib/apt/lists/* \
 && localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8
ENV LANG en_US.utf8
ENV LC_ALL en_US.UTF-8

# Fix error:
# Unable to determine CPU Frequency. Try defining CPU_MHZ.
# Exiting on SPEW_ABORT
ENV CPU_MHZ=2300

RUN groupadd -r steam && useradd -r -g steam -m -d /opt/steam steam
RUN usermod -a -G games steam

RUN dpkg --add-architecture i386
RUN apt-get -y update && apt-get install -y --no-install-recommends \
    build-essential=12.6 \
    ca-certificates \
    cmake=3.13.4-1 \
    curl \
    git=1:2.20.1-2+deb10u3 \
    gnupg2=2.2.12-1+deb10u1 \
    g++-multilib=4:8.3.0-1 \
    lib32gcc1=1:8.3.0-6 \
    libstdc++6:i386=8.3.0-6 \
    python=2.7.16-1 \
    unzip \
    xz-utils=5.2.4-1 \
    zip=3.0-11+b1 \
 && apt-get -y autoremove \
 && rm -rf /var/lib/apt/lists/*

RUN git clone --recursive https://github.com/FWGS/xash3d \
    && mkdir -p xash3d/build
WORKDIR /xash3d/build
RUN cmake -DXASH_DEDICATED=ON -DCMAKE_C_FLAGS="-m32" -DCMAKE_CXX_FLAGS="-m32" ../ \
    && make \
    && make install \
    && mv engine/xash3d /usr/local/bin/xashds \
    && rm -rf /xash3d

USER steam
WORKDIR /opt/steam
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
COPY server/lib/hlds.install /opt/steam

RUN curl -sL "$steamcmd_url" | tar xzvf - \
    && ./steamcmd.sh +runscript hlds.install

# RUN curl -sLJO "http://192.168.1.35:8080/hlds_build_$hlds_build.zip" \ host locally
RUN curl -sLJO "$hlds_url" \
    && unzip "hlds_build_$hlds_build.zip" -d "/opt/steam" \
    && cp -R "hlds_build_$hlds_build/"/* xashds/ \
    && rm -rf "hlds_build_$hlds_build" "hlds_build_$hlds_build.zip"

# Fix error that steamclient.so is missing
RUN mkdir -p "$HOME/.steam" \
    && ln -s /opt/steam/linux32 "$HOME/.steam/sdk32"

# Fix warnings:
# couldn't exec listip.cfg
# couldn't exec banned.cfg
RUN touch /opt/steam/xashds/valve/listip.cfg
RUN touch /opt/steam/xashds/valve/banned.cfg

# Install Metamod-P (for Xash3D by mittorn)
RUN mkdir -p /opt/steam/xashds/valve/addons/metamod/dlls \
    && touch /opt/steam/xashds/valve/addons/metamod/plugins.ini
RUN curl -sqL "$metamod_url" -o /opt/steam/xashds/valve/addons/metamod/dlls/metamod.so
RUN sed -i 's/dlls\/hl\.so/addons\/metamod\/dlls\/metamod.so/g' /opt/steam/xashds/valve/liblist.gam

# Install AMX mod X
RUN curl -sqL "$amxmod_url" | tar -C /opt/steam/xashds/valve/ -zxvf - \
    && echo 'linux addons/amxmodx/dlls/amxmodx_mm_i386.so' >> /opt/steam/xashds/valve/addons/metamod/plugins.ini
RUN cat /opt/steam/xashds/valve/mapcycle.txt >> /opt/steam/xashds/valve/addons/amxmodx/configs/maps.ini

WORKDIR /opt/steam/xashds

RUN mv cstrike/liblist.gam cstrike/gameinfo.txt
RUN mv valve/liblist.gam valve/gameinfo.txt

# Compile udpproxy and install webserver
COPY udpproxy /opt/steam/xashds/udpproxy

USER root
RUN apt-get -y update && apt-get install -y --no-install-recommends nginx && cd udpproxy && make all
COPY nginx.conf /etc/nginx

USER steam
# Copy default config
COPY server/valve valve
COPY static/models valve/models
# Copy static files
COPY static /static

EXPOSE 27015
EXPOSE 27015/udp
EXPOSE 3200
EXPOSE 3000

COPY start.sh .
USER root
# Run proxy in background & start server
ENTRYPOINT ["bash"]

# Default start parameters
CMD ["start.sh", "+ip 0.0.0.0", "-timeout 3", "-pingboost 1", "+rcon_password 12345678"]
# CMD ["+ip 0.0.0.0", "-timeout 3", "-pingboost 1", "+rcon_password 12345678"]
