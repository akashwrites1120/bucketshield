package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	targetURL := "http://localhost:8080"
	clientID := "client-dist"

	fmt.Printf("Starting concurrency integration test against %s...\n", targetURL)

	configPayload := map[string]interface{}{
		"clientId":   clientID,
		"maxTokens":  10.0,
		"refillRate": 0.0001,
	}
	body, err := json.Marshal(configPayload)
	if err != nil {
		fmt.Printf("Failed to marshal config: %v\n", err)
		os.Exit(1)
	}

	resp, err := http.Post(targetURL+"/api/config", "application/json", bytes.NewBuffer(body))
	if err != nil {
		fmt.Printf("Failed to update config: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		fmt.Printf("Config update returned status %d: %s\n", resp.StatusCode, string(respBody))
		os.Exit(1)
	}
	fmt.Println("Dynamic configuration set successfully (maxTokens=10.0, refillRate=0.0).")

	time.Sleep(500 * time.Millisecond)

	const numRequests = 100
	var wg sync.WaitGroup
	var allowedCount int64
	var rejectedCount int64
	var otherCount int64

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	fmt.Printf("Firing %d concurrent requests to /api/protected...\n", numRequests)

	for i := 0; i < numRequests; i++ {
		wg.Add(1)
		go func(reqNum int) {
			defer wg.Done()

			req, err := http.NewRequest(http.MethodPost, targetURL+"/api/protected", nil)
			if err != nil {
				fmt.Printf("Request %d build failed: %v\n", reqNum, err)
				atomic.AddInt64(&otherCount, 1)
				return
			}
			req.Header.Set("X-Client-ID", clientID)

			resp, err := client.Do(req)
			if err != nil {
				fmt.Printf("Request %d execute failed: %v\n", reqNum, err)
				atomic.AddInt64(&otherCount, 1)
				return
			}
			defer resp.Body.Close()

			switch resp.StatusCode {
			case http.StatusOK:
				atomic.AddInt64(&allowedCount, 1)
			case http.StatusTooManyRequests:
				atomic.AddInt64(&rejectedCount, 1)
			default:
				fmt.Printf("Request %d returned unexpected status %d\n", reqNum, resp.StatusCode)
				atomic.AddInt64(&otherCount, 1)
			}
		}(i)
	}

	wg.Wait()

	fmt.Println("-------------------------------------------")
	fmt.Printf("Results:\n")
	fmt.Printf("  Allowed (200 OK): %d\n", allowedCount)
	fmt.Printf("  Rejected (429):   %d\n", rejectedCount)
	fmt.Printf("  Errors/Other:     %d\n", otherCount)
	fmt.Println("-------------------------------------------")

	if allowedCount == 10 && rejectedCount == 90 {
		fmt.Println("SUCCESS: Distributed rate limiting working correctly!")
		fmt.Println("Atomic token bucket holds under high concurrent loads.")
	} else {
		fmt.Printf("FAILURE: Expected exactly 10 allowed and 90 rejected requests, but got Allowed=%d, Rejected=%d.\n", allowedCount, rejectedCount)
		os.Exit(1)
	}
}
