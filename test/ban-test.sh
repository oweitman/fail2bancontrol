#!/bin/bash
API="http://localhost:9000/api/jail"
HEADERS=(
  -H 'Accept: */*'
  -H 'Accept-Language: de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
  -H 'Connection: keep-alive'
  -H 'Content-Type: application/json'
  -H 'Origin: http://localhost:5173'
  -H 'Referer: http://localhost:5173/'
  -H 'Sec-Fetch-Dest: empty'
  -H 'Sec-Fetch-Mode: cors'
  -H 'Sec-Fetch-Site: same-origin'
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
  -H 'sec-ch-ua: "Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"'
  -H 'sec-ch-ua-mobile: ?0'
  -H 'sec-ch-ua-platform: "Windows"'
)

# Test-IPs
IPS=("101.101.101.101" "102.102.102.102" "103.103.103.103" "104.104.104.104" "105.105.105.105")

# Deine Jails (ergänze/ändere nach Bedarf)
JAILS=("nginx-garbage" "nginx-probing" "nginx-rootfreq" )

for jail in "${JAILS[@]}"; do
  echo "===> Testing jail: $jail"
  for ip in "${IPS[@]}"; do
    echo "Banning $ip in $jail..."
    curl -s "$API/$jail/ban" "${HEADERS[@]}" --data-raw "{\"ip\":\"$ip\"}"
    echo    # neue Zeile
  done
done
