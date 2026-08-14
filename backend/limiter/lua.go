package limiter

const tokenBucketLua = `
local state_key = KEYS[1]
local client_config_key = KEYS[2]
local default_config_key = KEYS[3]

local default_max_tokens = tonumber(ARGV[1])
local default_refill_rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3] or 1)

-- Resolve configuration
local max_tokens = default_max_tokens
local refill_rate = default_refill_rate

local client_config = redis.call('HMGET', client_config_key, 'max_tokens', 'refill_rate')
if client_config[1] and client_config[2] then
    max_tokens = tonumber(client_config[1])
    refill_rate = tonumber(client_config[2])
else
    local global_config = redis.call('HMGET', default_config_key, 'max_tokens', 'refill_rate')
    if global_config[1] and global_config[2] then
        max_tokens = tonumber(global_config[1])
        refill_rate = tonumber(global_config[2])
    end
end

-- Call Redis TIME
local redis_time = redis.call('TIME')
local now = tonumber(redis_time[1]) + (tonumber(redis_time[2]) / 1000000)

-- Fetch state
local state = redis.call('HMGET', state_key, 'tokens', 'last_refill_ts')
local tokens = tonumber(state[1])
local last_refill_ts = tonumber(state[2])

if not tokens or not last_refill_ts then
    tokens = max_tokens
    last_refill_ts = now
else
    local elapsed = now - last_refill_ts
    if elapsed > 0 then
        tokens = math.min(max_tokens, tokens + (elapsed * refill_rate))
        last_refill_ts = now
    end
end

local allowed = 0
if tokens >= cost then
    tokens = tokens - cost
    allowed = 1
end

-- Save state
redis.call('HSET', state_key, 'tokens', tostring(tokens), 'last_refill_ts', tostring(last_refill_ts))
redis.call('EXPIRE', state_key, 3600)

return {allowed, tostring(tokens), tostring(max_tokens), tostring(refill_rate)}
`
