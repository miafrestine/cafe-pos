import './ProductCard.css';
import { SIZES, SIZE_UPCHARGES, getModifier } from '../data/catalog.js';
import { peso } from '../utils/money.js';

export default function ProductCard({
  product,
  currentSize = 'Small',
  modifierOn = false,
  onAdd,
  onModifierToggle,
  onSizeSelect,
}) {
  const hasSizes = product.category === 'coffee';
  const modifier = getModifier(product);
  const unitPrice = product.price + (hasSizes ? SIZE_UPCHARGES[currentSize] ?? 0 : 0);
  const tags = product.tags ?? [];

  return (
    <article className="product-card">
      <div>
        <div className="product-card__image-wrap">
          <img src={product.image} alt={product.name} className="product-card__image" />
          <button
            type="button"
            onClick={() => onAdd(product)}
            className="product-card__add"
            title="Add to Ticket"
            aria-label={`Add ${product.name} to ticket`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
        </div>

        <div className="product-card__title-row">
          <h3>{product.name}</h3>
          <span>{peso(unitPrice)}</span>
        </div>
      </div>

      <div className="product-card__options-row">
        {hasSizes ? (
          <div className="product-card__sizes" role="group" aria-label={`${product.name} size`}>
            {SIZES.map((size) => {
              const upcharge = SIZE_UPCHARGES[size] ?? 0;
              return (
                <button
                  type="button"
                  key={size}
                  onClick={() => onSizeSelect?.(product.id, size)}
                  className={`product-card__size${size === currentSize ? ' is-active' : ''}`}
                  aria-pressed={size === currentSize}
                  title={upcharge > 0 ? `${size} (+${peso(upcharge)})` : size}
                >
                  {size[0]}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="product-card__tags">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}

        {onModifierToggle && (
          <div className="product-card__modifier-wrap">
            <span className="product-card__modifier-label">{modifier.label}</span>
            <button
              type="button"
              onClick={() => onModifierToggle(product)}
              className={`product-card__modifier${modifierOn ? ' is-active' : ''}`}
              aria-pressed={modifierOn}
              aria-label={`${modifierOn ? 'Remove' : 'Add'} ${modifier.label} for ${product.name}`}
              title={`${modifier.label} (+${peso(modifier.price)})`}
            >
              {modifierOn ? '✓' : '+'}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
