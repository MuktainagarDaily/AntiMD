import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoSlider } from '@/components/shared/PhotoSlider';

describe('PhotoSlider Component', () => {
  it('renders nothing when no photos or image_url provided', () => {
    const { container } = render(<PhotoSlider photos={[]} imageUrl={null} alt="Test" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a single image without arrows, counter, or dots when only one image is available', () => {
    render(
      <PhotoSlider
        photos={['/img1.jpg']}
        imageUrl="/img1.jpg"
        alt="Single Image Test"
      />
    );

    // No next/prev arrows
    expect(screen.queryByLabelText('Previous photo')).toBeNull();
    expect(screen.queryByLabelText('Next photo')).toBeNull();
    // No counter
    expect(screen.queryByText(/1\/1/)).toBeNull();
  });

  it('renders navigation controls and counter when multiple photos are provided', () => {
    render(
      <PhotoSlider
        photos={['/img1.jpg', '/img2.jpg', '/img3.jpg']}
        alt="Multi Image Test"
        showArrows
        showDots
        showCounter
      />
    );

    // Should have counter 1/3
    expect(screen.getByText('1/3')).toBeDefined();

    // Should have Next and Previous buttons
    const prevBtn = screen.getByLabelText('Previous photo');
    const nextBtn = screen.getByLabelText('Next photo');
    expect(prevBtn).toBeDefined();
    expect(nextBtn).toBeDefined();

    // Clicking next advances counter
    fireEvent.click(nextBtn);
    expect(screen.getByText('2/3')).toBeDefined();

    // Clicking next again
    fireEvent.click(nextBtn);
    expect(screen.getByText('3/3')).toBeDefined();

    // Clicking next wraps around to 1/3
    fireEvent.click(nextBtn);
    expect(screen.getByText('1/3')).toBeDefined();

    // Clicking prev wraps backwards to 3/3
    fireEvent.click(prevBtn);
    expect(screen.getByText('3/3')).toBeDefined();
  });

  it('renders horizontal thumbnails when showThumbnails is true and jumps to selected image on click', () => {
    render(
      <PhotoSlider
        photos={['/img1.jpg', '/img2.jpg']}
        alt="Thumbnail Test"
        showThumbnails
      />
    );

    const thumb2 = screen.getByAltText('Thumbnail Test thumbnail 2');
    expect(thumb2).toBeDefined();

    fireEvent.click(thumb2);
    expect(screen.getByText('2/2')).toBeDefined();
  });

  it('handles touch swipe navigation', () => {
    const { container } = render(
      <PhotoSlider
        photos={['/img1.jpg', '/img2.jpg', '/img3.jpg']}
        alt="Swipe Test"
      />
    );

    const stage = container.querySelector('.overflow-hidden');
    expect(stage).toBeDefined();

    // Simulate swipe left (next)
    fireEvent.touchStart(stage!, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(stage!, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(stage!, { changedTouches: [{ clientX: 100, clientY: 100 }] });

    expect(screen.getByText('2/3')).toBeDefined();
  });
});
