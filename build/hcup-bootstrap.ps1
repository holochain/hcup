# PowerShell v2/3 caches the output stream. Then it throws errors due
# to the FileStream not being what is expected. Fixes "The OS handle's
# position is not what FileStream expected. Do not use a handle
# simultaneously in one FileStream and in Win32 code or another
# FileStream."
function Fix-PowerShellOutputRedirectionBug {
  $poshMajorVerion = $PSVersionTable.PSVersion.Major

  if ($poshMajorVerion -lt 4) {
    try{
      # http://www.leeholmes.com/blog/2008/07/30/workaround-the-os-handles-position-is-not-what-filestream-expected/ plus comments
      $bindingFlags = [Reflection.BindingFlags] "Instance,NonPublic,GetField"
      $objectRef = $host.GetType().GetField("externalHostRef", $bindingFlags).GetValue($host)
      $bindingFlags = [Reflection.BindingFlags] "Instance,NonPublic,GetProperty"
      $consoleHost = $objectRef.GetType().GetProperty("Value", $bindingFlags).GetValue($objectRef, @())
      [void] $consoleHost.GetType().GetProperty("IsStandardOutputRedirected", $bindingFlags).GetValue($consoleHost, @())
      $bindingFlags = [Reflection.BindingFlags] "Instance,NonPublic,GetField"
      $field = $consoleHost.GetType().GetField("standardOutputWriter", $bindingFlags)
      $field.SetValue($consoleHost, [Console]::Out)
      [void] $consoleHost.GetType().GetProperty("IsStandardErrorRedirected", $bindingFlags).GetValue($consoleHost, @())
      $field2 = $consoleHost.GetType().GetField("standardErrorWriter", $bindingFlags)
      $field2.SetValue($consoleHost, [Console]::Error)
    } catch {
      Write-Output "Unable to apply redirection fix."
    }
  }
}

Fix-PowerShellOutputRedirectionBug

# Attempt to set highest encryption available for SecurityProtocol.
# PowerShell will not set this by default (until maybe .NET 4.6.x). This
# will typically produce a message for PowerShell v2 (just an info
# message though)
try {
  # Set TLS 1.2 (3072), then TLS 1.1 (768), then TLS 1.0 (192), finally SSL 3.0 (48)
  # Use integers because the enumeration values for TLS 1.2 and TLS 1.1 won't
  # exist in .NET 4.0, even though they are addressable if .NET 4.5+ is
  # installed (.NET 4.5 is an in-place upgrade).
  [System.Net.ServicePointManager]::SecurityProtocol = 3072 -bor 768 -bor 192 -bor 48
} catch {
  Write-Output 'Unable to set PowerShell to use TLS 1.2 and TLS 1.1 due to old .NET Framework installed. If you see underlying connection closed or trust errors, you may need to upgrade to .NET Framework 4.5+ and PowerShell v5'
}

function Get-Downloader {
param (
  [string]$url
 )

  $downloader = new-object System.Net.WebClient

  $defaultCreds = [System.Net.CredentialCache]::DefaultCredentials
  if ($defaultCreds -ne $null) {
    $downloader.Credentials = $defaultCreds
  }

  $ignoreProxy = $env:hcupIgnoreProxy
  if ($ignoreProxy -ne $null -and $ignoreProxy -eq 'true') {
    Write-Debug "Explicitly bypassing proxy due to user environment variable"
    $downloader.Proxy = [System.Net.GlobalProxySelection]::GetEmptyWebProxy()
  } else {
    # check if a proxy is required
    $explicitProxy = $env:hcupProxyLocation
    $explicitProxyUser = $env:hcupProxyUser
    $explicitProxyPassword = $env:hcupProxyPassword
    if ($explicitProxy -ne $null -and $explicitProxy -ne '') {
      # explicit proxy
      $proxy = New-Object System.Net.WebProxy($explicitProxy, $true)
      if ($explicitProxyPassword -ne $null -and $explicitProxyPassword -ne '') {
        $passwd = ConvertTo-SecureString $explicitProxyPassword -AsPlainText -Force
        $proxy.Credentials = New-Object System.Management.Automation.PSCredential ($explicitProxyUser, $passwd)
      }

      Write-Debug "Using explicit proxy server '$explicitProxy'."
      $downloader.Proxy = $proxy

    } elseif (!$downloader.Proxy.IsBypassed($url)) {
      # system proxy (pass through)
      $creds = $defaultCreds
      if ($creds -eq $null) {
        Write-Debug "Default credentials were null. Attempting backup method"
        $cred = get-credential
        $creds = $cred.GetNetworkCredential();
      }

      $proxyaddress = $downloader.Proxy.GetProxy($url).Authority
      Write-Debug "Using system proxy server '$proxyaddress'."
      $proxy = New-Object System.Net.WebProxy($proxyaddress)
      $proxy.Credentials = $creds
      $downloader.Proxy = $proxy
    }
  }

  return $downloader
}

function Download-String {
param (
  [string]$url
 )
  $downloader = Get-Downloader $url

  return $downloader.DownloadString($url)
}

function Download-File {
param (
  [string]$url,
  [string]$file
 )
  $downloader = Get-Downloader $url

  $downloader.DownloadFile($url, $file)
}

$dataDir = "$env:APPDATA"
$dataDir = Join-Path "$dataDir" "holo"
$dataDir = Join-Path "$dataDir" "hcup"
$dataDir = Join-Path "$dataDir" "data"
$binDir = Join-Path "$dataDir" "bin"

Write-Output "Create $dataDir"
if (![System.IO.Directory]::Exists($dataDir)) {[void][System.IO.Directory]::CreateDirectory($dataDir)}

Write-Output "Create $binDir"
if (![System.IO.Directory]::Exists($binDir)) {[void][System.IO.Directory]::CreateDirectory($binDir)}

$nodeUrl = "https://nodejs.org/dist/v8.15.1/node-v8.15.1-win-x64.zip"
$nodeFile = Join-Path "$dataDir" "node-v8.15.1-win-x64.zip"

Write-Output "Download $nodeUrl to $nodeFile"
Download-File $nodeUrl $nodeFile

if ($PSVersionTable.PSVersion.Major -lt 5) {
  throw "CANNOT EXTRACT psversion < 5"
}

Write-Output "Extract nodejs binary"
Expand-Archive -Path "$nodeFile" -DestinationPath "$dataDir" -Force

$tmpBin = Join-Path "$dataDir" "node-v8.15.1-win-x64"
$tmpBin = Join-Path "$tmpBin" "node.exe"

$nodeBin = Join-Path "$binDir" "hcup-node.exe"

Write-Output "Copy $tmpBin to $nodeBin"
Copy-Item "$tmpBin" -Destination "$nodeBin" -Force

Write-Output "Update PATH to include bin folder"
if ($env:Path -like "*$binDir*") {
  Write-Output "ALREADY IN PATH"
} else {
  $env:Path += ";$binDir"
  [Environment]::SetEnvironmentVariable
    ("Path", $env:Path, [System.EnvironmentVariableTarget]::Machine)
}

Write-Output "Write Bootstrap Script"
$bsFile = Join-Path "$dataDir" "bootstrap.js"
Set-Content -Path "$bsFile" -Value @'
{{{src}}}
'@

Invoke-Expression "$nodeBin $bsFile"
