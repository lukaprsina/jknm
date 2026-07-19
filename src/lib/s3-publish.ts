import { env } from "~/env";

export function get_s3_prefix(url: string, bucket: string) {
	// return `https://${bucket}.s3.${env.NEXT_PUBLIC_AWS_REGION}.amazonaws.com/${url}`;
	return `https://${bucket}.s3.${env.NEXT_PUBLIC_AWS_REGION}.backblazeb2.com/${url}`;
}
