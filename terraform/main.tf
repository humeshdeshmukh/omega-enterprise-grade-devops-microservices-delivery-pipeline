# Mock S3 Bucket for our application assets
resource "aws_s3_bucket" "omega_assets" {
  bucket = "omega-enterprise-assets-bucket"
}

# Optional: Disable block public access for LocalStack testing
resource "aws_s3_bucket_public_access_block" "omega_assets_access" {
  bucket = aws_s3_bucket.omega_assets.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# A mock SNS Topic for microservice events
resource "aws_sns_topic" "omega_events" {
  name = "omega-microservice-events"
}

# A mock SQS Queue
resource "aws_sqs_queue" "omega_queue" {
  name = "omega-processing-queue"
}

# Subscribe Queue to SNS
resource "aws_sns_topic_subscription" "omega_sns_sqs_target" {
  topic_arn = aws_sns_topic.omega_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.omega_queue.arn
}
