#! /bin/bash

echo "Starting...."
nginx
bash -c "./udpproxy/wsproxy 0.0.0.0:3200 &" && xashds $@