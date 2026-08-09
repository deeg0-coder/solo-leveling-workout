Add-Type -AssemblyName System.Drawing
$dir = "icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

function New-Icon([int]$S, [string]$Path) {
  $bmp = New-Object System.Drawing.Bitmap($S, $S)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # rounded background
  $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [int]($S * 0.22)
  $gp.AddArc(0, 0, $d, $d, 180, 90)
  $gp.AddArc($S - $d, 0, $d, $d, 270, 90)
  $gp.AddArc($S - $d, $S - $d, $d, $d, 0, 90)
  $gp.AddArc(0, $S - $d, $d, $d, 90, 90)
  $gp.CloseFigure()
  $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 7, 10, 24))
  $g.FillPath($bg, $gp)
  $bg.Dispose()

  # orange glow circle behind gate (subtle)
  $glow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 79, 195, 247))
  $g.FillEllipse($glow, [float]($S * 0.18), [float]($S * 0.18), [float]($S * 0.64), [float]($S * 0.64))
  $glow.Dispose()

  # gradient stroke diamond
  $p1 = New-Object System.Drawing.PointF(0, ($S * 0.5))
  $p2 = New-Object System.Drawing.PointF($S, ($S * 0.5))
  $gb = New-Object System.Drawing.Drawing2D.LinearGradientBrush($p1, $p2,
    ([System.Drawing.Color]::FromArgb(255, 79, 195, 247)),
    ([System.Drawing.Color]::FromArgb(255, 124, 77, 255)))
  $pen = New-Object System.Drawing.Pen($gb, [float]($S * 0.075))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $cx = $S / 2; $cy = $S / 2
  $w = $S * 0.62; $h = $S * 0.76
  $pts = @(
    (New-Object System.Drawing.PointF(($cx + 0.06 * $S), ($cy - $h / 2))),
    (New-Object System.Drawing.PointF(($cx + $w / 2), $cy)),
    (New-Object System.Drawing.PointF($cx, ($cy + $h / 2))),
    (New-Object System.Drawing.PointF(($cx - $w / 2), $cy))
  )
  $g.DrawLines($pen, $pts)
  $g.DrawLine($pen, $pts[0], $pts[1])
  $g.DrawLine($pen, $pts[2], $pts[3])
  $g.DrawLine($pen, $pts[3], $pts[0])

  # inner gold diamond
  $g2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 213, 74))
  $w2 = $S * 0.24; $h2 = $S * 0.3
  $inPts = @(
    (New-Object System.Drawing.PointF($cx, ($cy - $h2 / 2))),
    (New-Object System.Drawing.PointF(($cx + $w2 / 2), $cy)),
    (New-Object System.Drawing.PointF($cx, ($cy + $h2 / 2))),
    (New-Object System.Drawing.PointF(($cx - $w2 / 2), $cy))
  )
  $g.FillPolygon($g2, $inPts)
  $g2.Dispose(); $gb.Dispose(); $pen.Dispose(); $gp.Dispose()

  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output ("ok: " + $Path)
}

New-Icon 192 "$dir/icon-192.png"
New-Icon 512 "$dir/icon-512.png"