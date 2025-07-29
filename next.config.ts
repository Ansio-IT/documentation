
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static.wixstatic.com', // Added this hostname
        port: '',
        pathname: '/**',
      },
    ],
  },
  allowedDevOrigins: [
    '6000-firebase-studio-1749040445116.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev', 
    '9000-firebase-studio-1747738309739.cluster-zumahodzirciuujpqvsniawo3o.cloudworkstations.dev',
    '9000-firebase-studio-1749712191114.cluster-ubrd2huk7jh6otbgyei4h62ope.cloudworkstations.dev',
    'studio--retailsalesportal-cmvfo.us-central1.hosted.app'
  ]
};

export default nextConfig;
