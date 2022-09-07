FROM gcc:12.2

WORKDIR /app

COPY ./udpproxy /app/udpproxy

RUN apt update && apt install nginx -y && cd udpproxy && make all

COPY . /app/
COPY nginx.conf /etc/nginx

CMD nginx && ./udpproxy/wsproxy 0.0.0.0:3200

