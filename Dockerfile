FROM gcc:12.2

WORKDIR /app

COPY . /app/

RUN apt update && apt install nginx -y && cd udpproxy && make all

RUN mv ./nginx.conf /etc/nginx

CMD nginx && ./udpproxy/wsproxy 127.0.0.1:3200

