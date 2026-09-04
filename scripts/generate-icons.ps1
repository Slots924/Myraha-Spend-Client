Add-Type -AssemblyName System.Drawing

$iconDir = Join-Path (Split-Path $PSScriptRoot -Parent) "public\icons"
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

function New-Master([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 6, 22, 12))

  $dollarBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(95, 214, 176, 36))
  $font = New-Object System.Drawing.Font "Segoe UI", ([Math]::Max(18, $size / 4.6)), ([System.Drawing.FontStyle]::Bold)
  $spots = @(
    @(0.02, 0.00), @(0.52, -0.04), @(0.78, 0.18),
    @(-0.04, 0.38), @(0.70, 0.58), @(0.18, 0.70),
    @(0.40, 0.82), @(0.86, 0.78)
  )
  foreach ($spot in $spots) {
    $g.DrawString('$', $font, $dollarBrush, ($size * $spot[0]), ($size * $spot[1]))
  }

  $cx = $size / 2
  $cy = $size / 2
  $ew = $size * 0.88
  $eh = $size * 0.50

  $glow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 255, 70, 0))
  $g.FillEllipse($glow, ($cx - $ew / 2 - 6), ($cy - $eh / 2 - 6), ($ew + 12), ($eh + 12))

  $lid = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 78, 8, 6))
  $g.FillEllipse($lid, ($cx - $ew / 2), ($cy - $eh / 2), $ew, $eh)

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 214, 150))
  $g.FillEllipse($white, ($cx - $ew * 0.42), ($cy - $eh * 0.36), ($ew * 0.84), ($eh * 0.72))

  $iris = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 96, 8))
  $iw = $size * 0.40
  $g.FillEllipse($iris, ($cx - $iw / 2), ($cy - $iw / 2), $iw, $iw)

  $core = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 168, 12, 4))
  $cw = $size * 0.22
  $g.FillEllipse($core, ($cx - $cw / 2), ($cy - $cw / 2), $cw, $cw)

  $pupil = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 6, 2, 2))
  $pw = $size * 0.07
  $ph = $size * 0.36
  $g.FillEllipse($pupil, ($cx - $pw / 2), ($cy - $ph / 2), $pw, $ph)

  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 236, 190, 42), [Math]::Max(3, $size / 28))
  $g.DrawEllipse($pen, ($cx - $ew / 2), ($cy - $eh / 2), $ew, $eh)

  $g.Dispose()
  $dollarBrush.Dispose()
  $font.Dispose()
  $glow.Dispose()
  $lid.Dispose()
  $white.Dispose()
  $iris.Dispose()
  $core.Dispose()
  $pupil.Dispose()
  $pen.Dispose()
  return $bmp
}

$master = New-Master 256
foreach ($s in 16, 32, 48, 128) {
  $out = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.DrawImage($master, 0, 0, $s, $s)
  $path = Join-Path $iconDir "icon-$s.png"
  $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $out.Dispose()
}
$master.Dispose()
Write-Output "icons written to $iconDir"
