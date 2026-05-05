#!/bin/sh
source /root/.bashrc
xset -dpms
xinit /usr/local/bin/npm start -- :0 -nocursor
