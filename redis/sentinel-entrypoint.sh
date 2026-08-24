#!/bin/sh
# Wait for Redis master to be resolvable and ready before starting Sentinel

echo "Waiting for Redis master to be resolvable..."
MASTER_IP=""
while [ -z "$MASTER_IP" ]; do
  MASTER_IP=$(getent hosts bucketshield-redis-master | awk '{print $1}')
  if [ -z "$MASTER_IP" ]; then
    sleep 1
  fi
done

echo "Redis master resolved to $MASTER_IP. Checking if Redis is ready..."
while ! redis-cli -h bucketshield-redis-master ping >/dev/null 2>&1; do
  sleep 1
done

echo "Redis master ready. Updating sentinel.conf with IP address..."
cp /etc/redis/sentinel.conf /tmp/sentinel.conf
sed -i "s/bucketshield-redis-master/$MASTER_IP/g" /tmp/sentinel.conf

echo "Starting Sentinel..."
exec redis-sentinel /tmp/sentinel.conf