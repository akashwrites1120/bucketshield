package limiter

const slidingWindowLua = `
-- Sliding Window Rate Limiter Lua Script
-- Implements a sliding window log algorithm for comparison with token bucket
-- Uses a sorted set to store request timestamps

local window_key = KEYS[1]
local client_config_key = KEYS[2]
local default_config_key = KEYS[3]

local default_max_requests = tonumber(ARGV[1])
local default_window_sec = tonumber(ARGV[2])
local cost = tonumber(ARGV[3] or 1)

-- Resolve configuration
local max_requests = default_max_requests
local window_sec = default_window_sec

local client_config = redis.call('HMGET', client_config_key, 'max_requests', 'window_sec')
if client_config[1] and client_config[2] then
    max_requests = tonumber(client_config[1])
    window_sec = tonumber(client_config[2])
else
    local global_config = redis.call('HMGET', default_config_key, 'max_requests', 'window_sec')
    if global_config[1] and global_config[2] then
        max_requests = tonumber(global_config[1])
        window_sec = tonumber(global_config[2])
    end
end

-- Get current time from Redis (avoids clock drift)
local redis_time = redis.call('TIME')
local now = tonumber(redis_time[1]) + (tonumber(redis_time[2]) / 1000000)
local window_start = now - window_sec

-- Remove expired entries (older than window_start)
redis.call('ZREMRANGEBYSCORE', window_key, '-inf', window_start)

-- Count current requests in window
local current_count = redis.call('ZCARD', window_key)

local allowed = 0
if current_count < max_requests then
    -- Add current request with timestamp as score
    -- Use now + unique suffix to handle multiple requests at same timestamp
    local member = now .. ":" .. math.random(1000000)
    redis.call('ZADD', window_key, now, member)
    -- Set TTL to window_sec * 2 to clean up abandoned keys
    redis.call('EXPIRE', window_key, math.ceil(window_sec * 2))
    allowed = 1
    current_count = current_count + 1
end

-- Return: allowed (0/1), remaining, max_requests, window_sec, current_count
return {allowed, tostring(max_requests - current_count), tostring(max_requests), tostring(window_sec), tostring(current_count)}
`