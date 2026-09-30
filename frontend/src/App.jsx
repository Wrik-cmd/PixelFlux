import { useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [file, setFile] = useState(null);
  const [quality, setQuality] = useState(70);
  const [format, setFormat] = useState("webp");

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [result, setResult] = useState(null);

  // =========================================================
  // FILE SELECTION
  // =========================================================

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];

    if (!selectedFile) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    // Check image type
    if (!allowedTypes.includes(selectedFile.type)) {
      setError(
        "Only JPEG, PNG and WebP images are supported."
      );

      setFile(null);
      setResult(null);
      return;
    }

    // 10 MB limit
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("Maximum file size is 10 MB.");

      setFile(null);
      setResult(null);
      return;
    }

    setFile(selectedFile);
    setError("");
    setResult(null);
    setStatus("");
  };


  // =========================================================
  // COMPRESS IMAGE
  // =========================================================

  const compressImage = async () => {
    if (!file) {
      setError("Please select an image first.");
      return;
    }

    if (!API_URL) {
      setError(
        "API URL is not configured. Check your .env file."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      // =====================================================
      // STEP 1
      // Ask Lambda for a presigned S3 upload URL
      // =====================================================

      setStatus("Preparing upload...");

      const uploadResponse = await axios.post(
        `${API_URL}/upload`,
        {
          fileName: file.name,
          contentType: file.type,
          quality: quality,
          format: format,
        }
      );

      const {
        uploadUrl,
        outputKey,
      } = uploadResponse.data;

      if (!uploadUrl || !outputKey) {
        throw new Error(
          "Invalid response from upload API."
        );
      }


      // =====================================================
      // STEP 2
      // Upload image directly to S3
      // =====================================================

      setStatus("Uploading image to AWS S3...");

      await axios.put(
        uploadUrl,
        file,
        {
          headers: {
            "Content-Type": file.type,
          },
        }
      );


      // =====================================================
      // STEP 3
      // Wait for Lambda compression
      // =====================================================

      setStatus(
        "Compressing image with AWS Lambda..."
      );

      let downloadUrl = null;
      let compressedSize = null;

      // Check every 1.5 seconds
      // Maximum approximately 45 seconds

      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1500)
        );

        try {
          const response = await axios.get(
            `${API_URL}/download`,
            {
              params: {
                key: outputKey,
              },
            }
          );

          if (response.data.ready) {
            downloadUrl =
              response.data.downloadUrl;

            compressedSize =
              response.data.size;

            break;
          }
        } catch (err) {
          console.log(
            "Waiting for compression..."
          );
        }
      }


      // =====================================================
      // STEP 4
      // Check compression result
      // =====================================================

      if (!downloadUrl) {
        throw new Error(
          "Compression timed out. Please try again."
        );
      }

      const originalSize = file.size;

      const reduction = compressedSize
        ? (
            ((originalSize - compressedSize) /
              originalSize) *
            100
          ).toFixed(1)
        : null;


      // =====================================================
      // STEP 5
      // Store result
      // =====================================================

      setResult({
        downloadUrl,
        originalSize,
        compressedSize,
        reduction,
      });

      setStatus(
        "Compression completed successfully!"
      );

    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.error ||
        err.message ||
        "Something went wrong."
      );

      setStatus("");

    } finally {
      setLoading(false);
    }
  };


  // =========================================================
  // DOWNLOAD COMPRESSED IMAGE
  // =========================================================

  const downloadImage = async () => {
    if (!result?.downloadUrl) return;

    try {
      setStatus("Preparing download...");
      setError("");

      const response = await fetch(
        result.downloadUrl
      );

      if (!response.ok) {
        throw new Error(
          "Failed to download image."
        );
      }

      const blob = await response.blob();

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        `compressed-image.${format}`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

      setStatus(
        "Image downloaded successfully!"
      );

    } catch (err) {
      console.error(err);

      setError(
        "Unable to download the image."
      );

      setStatus("");
    }
  };


  // =========================================================
  // FORMAT FILE SIZE
  // =========================================================

  const formatSize = (bytes) => {
    if (!bytes) return "0 KB";

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  };


  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="app">

      <div className="card">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="header">

          <div className="header-brand">

            <div className="logo">
              PF
            </div>

            <h1>
              PixelFlux
            </h1>

          </div>

          <p>
            Serverless Image Compression
          </p>

        </div>


        {/* =================================================
            UPLOAD AREA
        ================================================= */}

        <div className="upload-area">

          <div className="upload-icon">
            ↑
          </div>

          <h2>
            Upload an image
          </h2>

          <p>
            JPEG, PNG or WebP • Maximum 10 MB
          </p>


          <label className="choose-button">

            Choose Image

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              hidden
            />

          </label>


          {/* Selected File */}

          {file && (
            <div className="selected-file">

              <strong>
                {file.name}
              </strong>

              <span>
                {formatSize(file.size)}
              </span>

            </div>
          )}

        </div>


        {/* =================================================
            SETTINGS
        ================================================= */}

        <div className="settings">

          {/* Compression Quality */}

          <div className="setting">

            <div className="setting-header">

              <label>
                Compression Quality
              </label>

              <span>
                {quality}%
              </span>

            </div>


            <input
              type="range"
              min="30"
              max="90"
              value={quality}
              onChange={(e) =>
                setQuality(
                  Number(e.target.value)
                )
              }
              disabled={loading}
            />


            <div className="range-labels">

              <span>
                Smaller
              </span>

              <span>
                Higher quality
              </span>

            </div>

          </div>


          {/* Output Format */}

          <div className="setting">

            <label>
              Output Format
            </label>


            <div className="format-buttons">

              <button
                type="button"
                className={
                  format === "jpeg"
                    ? "format active"
                    : "format"
                }
                onClick={() =>
                  setFormat("jpeg")
                }
                disabled={loading}
              >
                JPEG
              </button>


              <button
                type="button"
                className={
                  format === "png"
                    ? "format active"
                    : "format"
                }
                onClick={() =>
                  setFormat("png")
                }
                disabled={loading}
              >
                PNG
              </button>


              <button
                type="button"
                className={
                  format === "webp"
                    ? "format active"
                    : "format"
                }
                onClick={() =>
                  setFormat("webp")
                }
                disabled={loading}
              >
                WebP
              </button>

            </div>

          </div>

        </div>


        {/* =================================================
            COMPRESS BUTTON
        ================================================= */}

        <button
          type="button"
          className="compress-button"
          onClick={compressImage}
          disabled={loading || !file}
        >
          {loading
            ? "Compressing..."
            : "Compress Image"}
        </button>


        {/* =================================================
            STATUS
        ================================================= */}

        {status && (
          <div className="status">
            {status}
          </div>
        )}


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="error">
            {error}
          </div>
        )}


        {/* =================================================
            RESULT
        ================================================= */}

        {result && (
          <div className="result">

            <h2>
              Compression Complete 🎉
            </h2>


            <div className="stats">

              {/* Original */}

              <div>

                <span>
                  Original
                </span>

                <strong>
                  {formatSize(
                    result.originalSize
                  )}
                </strong>

              </div>


              {/* Compressed */}

              <div>

                <span>
                  Compressed
                </span>

                <strong>
                  {formatSize(
                    result.compressedSize
                  )}
                </strong>

              </div>


              {/* Reduction */}

              <div>

                <span>
                  Reduction
                </span>

                <strong>
                  {result.reduction}%
                </strong>

              </div>

            </div>


            {/* Download */}

            <button
              type="button"
              className="download-button"
              onClick={downloadImage}
            >
              Download Compressed Image
            </button>

          </div>
        )}


        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="footer">
          Powered by AWS • Built with React
        </div>

      </div>

    </div>
  );
}

export default App;